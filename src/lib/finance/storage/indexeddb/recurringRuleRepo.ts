/**
 * Life Atlas Finance: IndexedDB Recurring Rule Repository
 */

import { IRecurringRuleRepository } from "../interfaces";
import { RecurringRule, RecurringStatus, ID } from "../../domain/models";
import { validateRecurringRule } from "../../domain/validation";
import { StorageError } from "../../domain/errors";
import { getFinanceDB } from "./database";

export class IndexedDBRecurringRuleRepository implements IRecurringRuleRepository {
  private dbPromise: Promise<IDBDatabase>;

  constructor(customDbPromise?: Promise<IDBDatabase>) {
    this.dbPromise = customDbPromise || getFinanceDB();
  }

  async getById(id: ID): Promise<RecurringRule | null> {
    const db = await this.dbPromise;
    return new Promise<RecurringRule | null>((resolve, reject) => {
      const tx = db.transaction("recurring_rules", "readonly");
      const store = tx.objectStore("recurring_rules");
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result ? (req.result as RecurringRule) : null);
      req.onerror = () =>
        reject(new StorageError(`Failed to get recurring rule ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async getAll(status?: RecurringStatus): Promise<RecurringRule[]> {
    const db = await this.dbPromise;
    return new Promise<RecurringRule[]>((resolve, reject) => {
      const tx = db.transaction("recurring_rules", "readonly");
      const store = tx.objectStore("recurring_rules");
      const req = store.getAll();

      req.onsuccess = () => {
        let rules = (req.result as RecurringRule[]) || [];
        if (status) {
          rules = rules.filter((r) => r.status === status);
        }
        // Sort by nextDueDate ascending (upcoming first)
        rules.sort((a, b) => Date.parse(a.nextDueDate) - Date.parse(b.nextDueDate));
        resolve(rules);
      };
      req.onerror = () =>
        reject(new StorageError("Failed to fetch recurring rules", "PERSISTENCE_FAILED", req.error));
    });
  }

  async getByAccount(accountId: ID): Promise<RecurringRule[]> {
    const db = await this.dbPromise;
    return new Promise<RecurringRule[]>((resolve, reject) => {
      const tx = db.transaction("recurring_rules", "readonly");
      const store = tx.objectStore("recurring_rules");
      const index = store.index("accountId");
      const req = index.getAll(accountId);

      req.onsuccess = () => {
        const rules = (req.result as RecurringRule[]) || [];
        rules.sort((a, b) => Date.parse(a.nextDueDate) - Date.parse(b.nextDueDate));
        resolve(rules);
      };
      req.onerror = () =>
        reject(
          new StorageError(
            `Failed to fetch recurring rules for account ${accountId}`,
            "PERSISTENCE_FAILED",
            req.error
          )
        );
    });
  }

  async save(rule: RecurringRule): Promise<void> {
    const validated = validateRecurringRule(rule);
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("recurring_rules", "readwrite");
      const store = tx.objectStore("recurring_rules");
      const req = store.put(validated);

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(new StorageError(`Failed to save recurring rule ${rule.id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async delete(id: ID): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("recurring_rules", "readwrite");
      const store = tx.objectStore("recurring_rules");
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(new StorageError(`Failed to delete recurring rule ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }
}

