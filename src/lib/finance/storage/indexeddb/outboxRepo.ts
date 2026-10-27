/**
 * Life Atlas Finance: IndexedDB Sync Outbox Repository
 * 
 * Local-first offline change outbox with claimed leases, bounded retries,
 * stable idempotency, and recovery of abandoned in-progress operations.
 */

import { ISyncOutboxRepository } from "../interfaces";
import { SyncOperation, SyncStatus, ID } from "../../domain/models";
import { validateSyncOperation } from "../../domain/validation";
import { StorageError } from "../../domain/errors";
import { getFinanceDB } from "./database";

export class IndexedDBOutboxRepository implements ISyncOutboxRepository {
  private dbPromise: Promise<IDBDatabase>;

  constructor(customDbPromise?: Promise<IDBDatabase>) {
    this.dbPromise = customDbPromise || getFinanceDB();
  }

  async enqueue(operation: SyncOperation): Promise<void> {
    const validated = validateSyncOperation(operation);
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sync_outbox", "readwrite");
      const store = tx.objectStore("sync_outbox");
      const index = store.index("idempotencyKey");

      // Idempotency check: don't double-enqueue if the exact idempotencyKey already exists
      const checkReq = index.get(validated.idempotencyKey);

      checkReq.onsuccess = () => {
        if (checkReq.result) {
          // Already in outbox, idempotent success
          resolve();
          return;
        }

        const putReq = store.put(validated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () =>
          reject(new StorageError(`Failed to enqueue outbox op ${validated.id}`, "PERSISTENCE_FAILED", putReq.error));
      };

      checkReq.onerror = () => {
        reject(new StorageError("Failed to verify idempotency in outbox", "PERSISTENCE_FAILED", checkReq.error));
      };
    });
  }

  async getById(id: ID): Promise<SyncOperation | null> {
    const db = await this.dbPromise;
    return new Promise<SyncOperation | null>((resolve, reject) => {
      const tx = db.transaction("sync_outbox", "readonly");
      const store = tx.objectStore("sync_outbox");
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result ? (req.result as SyncOperation) : null);
      req.onerror = () =>
        reject(new StorageError(`Failed to get outbox op ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async getAll(status?: SyncStatus): Promise<SyncOperation[]> {
    const db = await this.dbPromise;
    return new Promise<SyncOperation[]>((resolve, reject) => {
      const tx = db.transaction("sync_outbox", "readonly");
      const store = tx.objectStore("sync_outbox");
      const req = store.getAll();

      req.onsuccess = () => {
        let ops = (req.result as SyncOperation[]) || [];
        if (status) {
          ops = ops.filter((o) => o.status === status);
        }
        ops.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
        resolve(ops);
      };
      req.onerror = () =>
        reject(new StorageError("Failed to fetch outbox operations", "PERSISTENCE_FAILED", req.error));
    });
  }

  async getPending(limit: number = 50): Promise<SyncOperation[]> {
    const db = await this.dbPromise;
    const now = new Date().toISOString();

    return new Promise<SyncOperation[]>((resolve, reject) => {
      const tx = db.transaction("sync_outbox", "readonly");
      const store = tx.objectStore("sync_outbox");
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as SyncOperation[]) || [];
        // Filter pending or retryable whose nextRetryAt has arrived
        const eligible = all.filter((o) => {
          if (o.status === "pending") return true;
          if (o.status === "failed_retryable") {
            return !o.nextRetryAt || o.nextRetryAt <= now;
          }
          return false;
        });

        eligible.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
        resolve(eligible.slice(0, limit));
      };

      req.onerror = () =>
        reject(new StorageError("Failed to fetch pending outbox operations", "PERSISTENCE_FAILED", req.error));
    });
  }

  async claimPending(claimToken: string, limit: number = 50): Promise<SyncOperation[]> {
    const db = await this.dbPromise;
    const now = new Date().toISOString();

    return new Promise<SyncOperation[]>((resolve, reject) => {
      const tx = db.transaction("sync_outbox", "readwrite");
      const store = tx.objectStore("sync_outbox");
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as SyncOperation[]) || [];
        const eligible = all.filter((o) => {
          if (o.status === "pending") return true;
          if (o.status === "failed_retryable") {
            return !o.nextRetryAt || o.nextRetryAt <= now;
          }
          return false;
        });

        eligible.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
        const toClaim = eligible.slice(0, limit);

        for (const op of toClaim) {
          op.status = "in_progress";
          op.claimToken = claimToken;
          op.claimedAt = now;
          store.put(op);
        }

        resolve(toClaim);
      };

      req.onerror = () =>
        reject(new StorageError("Failed to claim pending outbox operations", "PERSISTENCE_FAILED", req.error));
    });
  }

  async markSynced(id: ID): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sync_outbox", "readwrite");
      const store = tx.objectStore("sync_outbox");
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const op = getReq.result as SyncOperation | undefined;
        if (!op) {
          resolve();
          return;
        }

        op.status = "synced";
        op.claimToken = undefined;
        op.claimedAt = undefined;
        const putReq = store.put(op);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () =>
          reject(new StorageError(`Failed to mark op ${id} synced`, "PERSISTENCE_FAILED", putReq.error));
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  async markFailed(id: ID, error: string): Promise<void> {
    return this.markFailedPermanent(id, error);
  }

  async markFailedRetryable(id: ID, error: string, nextRetryAt: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sync_outbox", "readwrite");
      const store = tx.objectStore("sync_outbox");
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const op = getReq.result as SyncOperation | undefined;
        if (!op) {
          resolve();
          return;
        }

        op.status = "failed_retryable";
        op.retryCount = (op.retryCount || 0) + 1;
        op.lastError = error;
        op.nextRetryAt = nextRetryAt;
        op.claimToken = undefined;
        op.claimedAt = undefined;

        const putReq = store.put(op);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () =>
          reject(new StorageError(`Failed to update op ${id} retry status`, "PERSISTENCE_FAILED", putReq.error));
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  async markFailedPermanent(id: ID, error: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sync_outbox", "readwrite");
      const store = tx.objectStore("sync_outbox");
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const op = getReq.result as SyncOperation | undefined;
        if (!op) {
          resolve();
          return;
        }

        op.status = "failed_permanent";
        op.lastError = error;
        op.claimToken = undefined;
        op.claimedAt = undefined;

        const putReq = store.put(op);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () =>
          reject(new StorageError(`Failed to mark op ${id} permanently failed`, "PERSISTENCE_FAILED", putReq.error));
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  async releaseStaleClaims(timeoutMs: number = 60000): Promise<number> {
    const db = await this.dbPromise;
    const cutoff = new Date(Date.now() - timeoutMs).toISOString();

    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction("sync_outbox", "readwrite");
      const store = tx.objectStore("sync_outbox");
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as SyncOperation[]) || [];
        let released = 0;

        for (const op of all) {
          if (op.status === "in_progress" && op.claimedAt && op.claimedAt < cutoff) {
            op.status = "pending";
            op.claimToken = undefined;
            op.claimedAt = undefined;
            store.put(op);
            released++;
          }
        }
        resolve(released);
      };

      req.onerror = () => reject(req.error);
    });
  }

  async retryFailed(): Promise<number> {
    const db = await this.dbPromise;
    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction("sync_outbox", "readwrite");
      const store = tx.objectStore("sync_outbox");
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as SyncOperation[]) || [];
        let resetCount = 0;

        for (const op of all) {
          if (op.status === "failed_retryable" || op.status === "failed_permanent" || op.status === "failed") {
            op.status = "pending";
            op.nextRetryAt = undefined;
            op.claimToken = undefined;
            op.claimedAt = undefined;
            store.put(op);
            resetCount++;
          }
        }
        resolve(resetCount);
      };

      req.onerror = () => reject(req.error);
    });
  }

  async clearCompleted(): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sync_outbox", "readwrite");
      const store = tx.objectStore("sync_outbox");
      const req = store.getAll();

      req.onsuccess = () => {
        const all = (req.result as SyncOperation[]) || [];
        for (const op of all) {
          if (op.status === "synced") {
            store.delete(op.id);
          }
        }
        resolve();
      };

      req.onerror = () => reject(req.error);
    });
  }
}
