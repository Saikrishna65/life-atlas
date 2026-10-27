/**
 * Life Atlas Finance: Sync Outbox Application Service & Processor
 * 
 * Drives reliable, idempotent outbox processing, bounded backoff retries,
 * stale lease reclamation, and conflict staging.
 */

import { IUnitOfWork } from "../storage/interfaces";
import {
  SyncOperation,
  SyncConflict,
  ID,
} from "../domain/models";
import {
  ICloudSyncAdapter,
  SYNC_PROTOCOL_VERSION,
  SyncPushRequest,
} from "../infrastructure/syncProtocol";

export interface OutboxProcessingStats {
  claimedCount: number;
  acknowledgedCount: number;
  retryableFailedCount: number;
  permanentFailedCount: number;
  staleRecoveredCount: number;
}

export class SyncOutboxService {
  private baseBackoffMs = 1000;
  private maxBackoffMs = 30000;
  private maxRetries = 5;

  constructor(
    private readonly uow: IUnitOfWork,
    private readonly syncAdapter: ICloudSyncAdapter,
    private readonly clientId: string = "client_default"
  ) {}

  /**
   * Processes pending and retry-eligible outbox operations in deterministic order.
   */
  async processOutbox(batchSize = 25): Promise<OutboxProcessingStats> {
    const stats: OutboxProcessingStats = {
      claimedCount: 0,
      acknowledgedCount: 0,
      retryableFailedCount: 0,
      permanentFailedCount: 0,
      staleRecoveredCount: 0,
    };

    // 1. Recover any abandoned in-progress claims older than 60s
    stats.staleRecoveredCount = await this.uow.outbox.releaseStaleClaims(60000);

    // 2. If sync adapter is not configured, do not claim or pretend to push
    if (!this.syncAdapter.isConfigured()) {
      return stats;
    }

    // 3. Claim a batch of eligible operations
    const claimToken = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const claimedOps = await this.uow.outbox.claimPending(claimToken, batchSize);
    stats.claimedCount = claimedOps.length;

    if (claimedOps.length === 0) {
      return stats;
    }

    const pushRequest: SyncPushRequest = {
      protocolVersion: SYNC_PROTOCOL_VERSION,
      clientId: this.clientId,
      operations: claimedOps,
    };

    try {
      const pushResult = await this.syncAdapter.push(pushRequest);

      // A. Handle durably acknowledged operations
      for (const ackId of pushResult.acknowledgedIds) {
        await this.uow.outbox.markSynced(ackId);
        stats.acknowledgedCount++;
      }

      // B. Handle rejected operations
      for (const rej of pushResult.rejected) {
        const op = claimedOps.find((o) => o.id === rej.id);
        if (!op) continue;

        if (rej.permanent || (op.retryCount || 0) >= this.maxRetries) {
          // Classify as permanently failed
          await this.uow.outbox.markFailedPermanent(
            rej.id,
            `Permanent rejection: ${rej.reason}`
          );
          stats.permanentFailedCount++;
        } else {
          // Calculate exponential backoff
          const nextRetryAt = this.calculateNextRetryAt(op.retryCount || 0);
          await this.uow.outbox.markFailedRetryable(rej.id, rej.reason, nextRetryAt);
          stats.retryableFailedCount++;
        }
      }
    } catch (err: unknown) {
      // Network timeout or adapter failure: mark all claimed operations as retryable with backoff
      const errorMsg = (err as Error).message || "Sync network failure";

      for (const op of claimedOps) {
        const currentRetry = op.retryCount || 0;
        if (currentRetry >= this.maxRetries) {
          await this.uow.outbox.markFailedPermanent(
            op.id,
            `Max retries reached (${this.maxRetries}): ${errorMsg}`
          );
          stats.permanentFailedCount++;
        } else {
          const nextRetryAt = this.calculateNextRetryAt(currentRetry);
          await this.uow.outbox.markFailedRetryable(op.id, errorMsg, nextRetryAt);
          stats.retryableFailedCount++;
        }
      }
    }

    return stats;
  }

  /**
   * Pushes pending outbox operations to cloud adapter. Alias/wrapper around processOutbox.
   */
  async pushPending(batchSize = 25): Promise<{ pushedCount: number; failedCount: number }> {
    const stats = await this.processOutbox(batchSize);
    return {
      pushedCount: stats.acknowledgedCount,
      failedCount: stats.retryableFailedCount + stats.permanentFailedCount,
    };
  }

  /**
   * Purges completed/synced records from the local outbox store.
   */
  async purgeCompleted(retentionDays = 0): Promise<number> {
    const all = await this.uow.outbox.getAll();
    const synced = all.filter((o) => o.status === "synced");
    await this.uow.outbox.clearCompleted();
    return synced.length;
  }

  /**
   * Resets failed operations back to pending so the user can manually re-trigger sync.
   */
  async retryFailedOperations(): Promise<number> {
    return this.uow.outbox.retryFailed();
  }

  /**
   * Fetches outbox queue status metrics.
   */
  async getQueueStatus(): Promise<{
    pendingCount: number;
    inProgressCount: number;
    failedRetryableCount: number;
    failedPermanentCount: number;
    syncedCount: number;
  }> {
    const all = await this.uow.outbox.getAll();

    return {
      pendingCount: all.filter((o) => o.status === "pending").length,
      inProgressCount: all.filter((o) => o.status === "in_progress").length,
      failedRetryableCount: all.filter((o) => o.status === "failed_retryable").length,
      failedPermanentCount: all.filter((o) => o.status === "failed_permanent" || o.status === "failed").length,
      syncedCount: all.filter((o) => o.status === "synced").length,
    };
  }

  /**
   * Reconciles remote incoming entity changes against local state.
   * Protects financial ledger invariants and transfer integrity.
   */
  async reconcileRemoteChanges(): Promise<{ appliedCount: number; conflictCount: number }> {
    if (!this.syncAdapter.isConfigured()) {
      return { appliedCount: 0, conflictCount: 0 };
    }

    const pullResult = await this.syncAdapter.pull({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      clientId: this.clientId,
    });

    let appliedCount = 0;
    let conflictCount = 0;

    for (const change of pullResult.changes) {
      if (change.entityType === "transaction") {
        const localTxn = await this.uow.transactions.getById(change.entityId);

        if (!localTxn) {
          // New transaction from remote: parse and save locally
          try {
            const parsed = JSON.parse(change.payloadJson);
            await this.uow.transactions.save(parsed);
            appliedCount++;
          } catch {
            conflictCount++;
          }
        } else if (localTxn.version < change.version) {
          // Remote has newer version: check if transfer leg
          if (localTxn.transferGroupId) {
            // Validate transfer partner
            const group = await this.uow.transactions.getByTransferGroupId(localTxn.transferGroupId);
            if (group.length === 2) {
              const parsed = JSON.parse(change.payloadJson);
              await this.uow.transactions.save(parsed);
              appliedCount++;
            } else {
              // Staged conflict: partner leg missing
              await this.recordConflict(change, localTxn);
              conflictCount++;
            }
          } else {
            const parsed = JSON.parse(change.payloadJson);
            await this.uow.transactions.save(parsed);
            appliedCount++;
          }
        } else if (localTxn.version > change.version) {
          // Local is newer: preserve local
        } else {
          // Same version: compare timestamps
          if (localTxn.updatedAt !== change.timestamp) {
            await this.recordConflict(change, localTxn);
            conflictCount++;
          }
        }
      }
    }

    return { appliedCount, conflictCount };
  }

  private async recordConflict(change: { entityType: string; entityId: ID; payloadJson: string }, localEntity: unknown): Promise<void> {
    const conflict: SyncConflict = {
      id: `cnf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      operationId: `op_rem_${change.entityId}`,
      entityType: change.entityType as any,
      entityId: change.entityId,
      localPayloadJson: JSON.stringify(localEntity),
      remotePayloadJson: change.payloadJson,
      resolution: "unresolved",
      createdAt: new Date().toISOString(),
    };
    await this.uow.conflicts.save(conflict);
  }

  private calculateNextRetryAt(retryCount: number): string {
    const backoff = Math.min(this.maxBackoffMs, this.baseBackoffMs * Math.pow(2, retryCount));
    const jitter = Math.floor(Math.random() * 500);
    const delay = backoff + jitter;
    return new Date(Date.now() + delay).toISOString();
  }
}
