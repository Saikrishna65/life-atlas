/**
 * Life Atlas Finance: IndexedDB Audit Repository
 */

import { IAuditRepository } from "../interfaces";
import { AuditEvent, ID } from "../../domain/models";
import { StorageError } from "../../domain/errors";
import { getFinanceDB } from "./database";

export class IndexedDBAuditRepository implements IAuditRepository {
  private dbPromise: Promise<IDBDatabase>;

  constructor(customDbPromise?: Promise<IDBDatabase>) {
    this.dbPromise = customDbPromise || getFinanceDB();
  }

  async record(event: AuditEvent): Promise<void> {
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("audit_log", "readwrite");
      const store = tx.objectStore("audit_log");
      const req = store.put(event);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(new StorageError(`Failed to record audit event ${event.id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async getByEntity(entityType: string, entityId: ID): Promise<AuditEvent[]> {
    const db = await this.dbPromise;

    return new Promise<AuditEvent[]>((resolve, reject) => {
      const tx = db.transaction("audit_log", "readonly");
      const store = tx.objectStore("audit_log");
      const index = store.index("entityId");
      const req = index.getAll(entityId);

      req.onsuccess = () => {
        let events = (req.result as AuditEvent[]) || [];
        events = events.filter((e) => e.entityType === entityType);
        events.sort((a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt));
        resolve(events);
      };
      req.onerror = () => reject(new StorageError(`Failed to get audit log for ${entityId}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async getAll(limit: number = 100): Promise<AuditEvent[]> {
    const db = await this.dbPromise;

    return new Promise<AuditEvent[]>((resolve, reject) => {
      const tx = db.transaction("audit_log", "readonly");
      const store = tx.objectStore("audit_log");
      const req = store.getAll();

      req.onsuccess = () => {
        const events = (req.result as AuditEvent[]) || [];
        events.sort((a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt));
        resolve(events.slice(0, limit));
      };
      req.onerror = () => reject(new StorageError("Failed to fetch audit log", "PERSISTENCE_FAILED", req.error));
    });
  }
}

