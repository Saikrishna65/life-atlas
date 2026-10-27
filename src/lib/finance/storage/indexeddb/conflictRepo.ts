/**
 * Life Atlas Finance: IndexedDB Sync Conflict Repository
 */

import { ISyncConflictRepository } from "../interfaces";
import { SyncConflict, ConflictResolutionType, ID } from "../../domain/models";
import { validateSyncConflict } from "../../domain/validation";
import { StorageError } from "../../domain/errors";
import { getFinanceDB } from "./database";

export class IndexedDBConflictRepository implements ISyncConflictRepository {
  private dbPromise: Promise<IDBDatabase>;

  constructor(customDbPromise?: Promise<IDBDatabase>) {
    this.dbPromise = customDbPromise || getFinanceDB();
  }

  async getById(id: ID): Promise<SyncConflict | null> {
    const db = await this.dbPromise;
    return new Promise<SyncConflict | null>((resolve, reject) => {
      const tx = db.transaction("sync_conflicts", "readonly");
      const store = tx.objectStore("sync_conflicts");
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result ? (req.result as SyncConflict) : null);
      req.onerror = () =>
        reject(new StorageError(`Failed to get sync conflict ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async getAll(unresolvedOnly = false): Promise<SyncConflict[]> {
    const db = await this.dbPromise;
    return new Promise<SyncConflict[]>((resolve, reject) => {
      const tx = db.transaction("sync_conflicts", "readonly");
      const store = tx.objectStore("sync_conflicts");
      const req = store.getAll();

      req.onsuccess = () => {
        let conflicts = (req.result as SyncConflict[]) || [];
        if (unresolvedOnly) {
          conflicts = conflicts.filter((c) => c.resolution === "unresolved");
        }
        conflicts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        resolve(conflicts);
      };

      req.onerror = () =>
        reject(new StorageError("Failed to fetch sync conflicts", "PERSISTENCE_FAILED", req.error));
    });
  }

  async save(conflict: SyncConflict): Promise<void> {
    const validated = validateSyncConflict(conflict);
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sync_conflicts", "readwrite");
      const store = tx.objectStore("sync_conflicts");
      const req = store.put(validated);

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(new StorageError(`Failed to save sync conflict ${conflict.id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async resolve(id: ID, resolution: ConflictResolutionType, resolvedPayloadJson?: string): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sync_conflicts", "readwrite");
      const store = tx.objectStore("sync_conflicts");
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const conflict = getReq.result as SyncConflict | undefined;
        if (!conflict) {
          resolve();
          return;
        }

        conflict.resolution = resolution;
        if (resolvedPayloadJson) {
          conflict.resolvedPayloadJson = resolvedPayloadJson;
        }
        conflict.resolvedAt = new Date().toISOString();

        const putReq = store.put(conflict);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () =>
          reject(new StorageError(`Failed to resolve conflict ${id}`, "PERSISTENCE_FAILED", putReq.error));
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  async delete(id: ID): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sync_conflicts", "readwrite");
      const store = tx.objectStore("sync_conflicts");
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(new StorageError(`Failed to delete sync conflict ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }
}

