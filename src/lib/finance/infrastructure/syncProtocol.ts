/**
 * Life Atlas Finance: Versioned Cloud Sync Protocol & Adapters
 * 
 * Defines the contract, payloads, and boundary for local-first synchronization.
 * Includes UnconfiguredCloudSyncAdapter (honest offline state) and TestableCloudSyncAdapter.
 */

import { SyncOperation, ID } from "../domain/models";
import { FinanceError } from "../domain/errors";

export const SYNC_PROTOCOL_VERSION = 1;

export interface SyncPushRequest {
  protocolVersion: number;
  clientId: string;
  operations: SyncOperation[];
}

export interface SyncOperationRejection {
  id: ID;
  reason: string;
  permanent: boolean;
}

export interface SyncPushResult {
  acknowledgedIds: ID[];
  rejected: SyncOperationRejection[];
  serverTimestamp: string;
}

export interface SyncPullRequest {
  protocolVersion: number;
  clientId: string;
  sinceCursor?: string;
  limit?: number;
}

export interface RemoteEntityChange {
  entityType: string;
  entityId: ID;
  action: "create" | "update" | "delete";
  version: number;
  payloadJson: string;
  timestamp: string;
}

export interface SyncPullResult {
  changes: RemoteEntityChange[];
  nextCursor: string;
  hasMore: boolean;
  serverTimestamp: string;
}

export interface ICloudSyncAdapter {
  getAdapterName(): string;
  isConfigured(): boolean;
  push(request: SyncPushRequest): Promise<SyncPushResult>;
  pull(request: SyncPullRequest): Promise<SyncPullResult>;
}

/**
 * Honest, non-fabricated adapter used when no cloud sync server is configured.
 * Clearly informs callers that data is local-only without pretending cloud sync succeeded.
 */
export class UnconfiguredCloudSyncAdapter implements ICloudSyncAdapter {
  getAdapterName(): string {
    return "Local-Only Offline Vault (Cloud Sync Unconfigured)";
  }

  isConfigured(): boolean {
    return false;
  }

  async push(_request: SyncPushRequest): Promise<SyncPushResult> {
    throw new FinanceError(
      "Cloud synchronization is unconfigured. Life Atlas is running in 100% offline mode. Your financial data is preserved on this device.",
      "STORAGE_UNAVAILABLE"
    );
  }

  async pull(_request: SyncPullRequest): Promise<SyncPullResult> {
    throw new FinanceError(
      "Cloud synchronization is unconfigured. Cannot pull remote changes.",
      "STORAGE_UNAVAILABLE"
    );
  }
}

/**
 * In-memory testable sync adapter for validating outbox processing, network retries,
 * and conflict resolution within unit & integration tests.
 */
export class TestableCloudSyncAdapter implements ICloudSyncAdapter {
  private remoteStore = new Map<string, RemoteEntityChange>();
  private processedIdempotencyKeys = new Set<string>();
  private configuredRejections = new Map<ID, { permanent: boolean; reason: string }>();
  private simulateNetworkFailure = false;
  private failNextPushWithPermanent = false;
  private cursorCounter = 0;

  getAdapterName(): string {
    return "Testable In-Memory Sync Mock";
  }

  isConfigured(): boolean {
    return true;
  }

  setSimulateNetworkFailure(fail: boolean): void {
    this.simulateNetworkFailure = fail;
  }

  setFailNextPushWithPermanent(fail: boolean): void {
    this.failNextPushWithPermanent = fail;
  }

  configureRejections(ids: ID[], permanent: boolean, reason: string): void {
    for (const id of ids) {
      this.configuredRejections.set(id, { permanent, reason });
    }
  }

  seedRemoteChange(change: RemoteEntityChange): void {
    this.remoteStore.set(`${change.entityType}:${change.entityId}`, change);
  }

  seedRemoteChanges(changes: RemoteEntityChange[]): void {
    for (const c of changes) {
      this.seedRemoteChange(c);
    }
  }

  async push(request: SyncPushRequest): Promise<SyncPushResult> {
    if (this.simulateNetworkFailure) {
      throw new FinanceError("Network unreachable / connection timeout", "STORAGE_UNAVAILABLE");
    }

    if (this.failNextPushWithPermanent) {
      this.failNextPushWithPermanent = false;
      return {
        acknowledgedIds: [],
        rejected: request.operations.map((op) => ({
          id: op.id,
          reason: "Schema validation rejected by remote server",
          permanent: true,
        })),
        serverTimestamp: new Date().toISOString(),
      };
    }

    const acknowledgedIds: ID[] = [];
    const rejected: SyncOperationRejection[] = [];

    for (const op of request.operations) {
      if (this.configuredRejections.has(op.id)) {
        const rej = this.configuredRejections.get(op.id)!;
        rejected.push({
          id: op.id,
          reason: rej.reason,
          permanent: rej.permanent,
        });
        continue;
      }
      // Idempotency: duplicate pushes of same idempotency key succeed without duplicating
      if (this.processedIdempotencyKeys.has(op.idempotencyKey)) {
        acknowledgedIds.push(op.id);
        continue;
      }

      this.processedIdempotencyKeys.add(op.idempotencyKey);
      this.remoteStore.set(`${op.entityType}:${op.entityId}`, {
        entityType: op.entityType,
        entityId: op.entityId,
        action: op.action,
        version: 1,
        payloadJson: op.payloadJson,
        timestamp: op.timestamp,
      });

      acknowledgedIds.push(op.id);
    }

    return {
      acknowledgedIds,
      rejected,
      serverTimestamp: new Date().toISOString(),
    };
  }

  async pull(request: SyncPullRequest): Promise<SyncPullResult> {
    if (this.simulateNetworkFailure) {
      throw new FinanceError("Network unreachable", "STORAGE_UNAVAILABLE");
    }

    const allChanges = Array.from(this.remoteStore.values());
    this.cursorCounter++;

    return {
      changes: allChanges,
      nextCursor: `cursor_${this.cursorCounter}`,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
    };
  }
}
