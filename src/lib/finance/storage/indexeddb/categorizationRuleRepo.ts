/**
 * Life Atlas Finance: IndexedDB Categorization Rule Repository
 */

import { ICategorizationRuleRepository } from "../interfaces";
import { CategorizationRule, ID } from "../../domain/models";
import { validateCategorizationRule } from "../../domain/validation";
import { StorageError } from "../../domain/errors";
import { getFinanceDB } from "./database";
import { DEFAULT_CATEGORIZATION_RULES } from "./migrations";

export class IndexedDBCategorizationRuleRepository implements ICategorizationRuleRepository {
  private dbPromise: Promise<IDBDatabase>;

  constructor(customDbPromise?: Promise<IDBDatabase>) {
    this.dbPromise = customDbPromise || getFinanceDB();
  }

  async getById(id: ID): Promise<CategorizationRule | null> {
    const db = await this.dbPromise;
    return new Promise<CategorizationRule | null>((resolve, reject) => {
      const tx = db.transaction("categorization_rules", "readonly");
      const store = tx.objectStore("categorization_rules");
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result ? (req.result as CategorizationRule) : null);
      req.onerror = () =>
        reject(new StorageError(`Failed to get categorization rule ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async getAll(activeOnly = false): Promise<CategorizationRule[]> {
    const db = await this.dbPromise;
    return new Promise<CategorizationRule[]>((resolve, reject) => {
      const tx = db.transaction("categorization_rules", "readonly");
      const store = tx.objectStore("categorization_rules");
      const req = store.getAll();

      req.onsuccess = () => {
        let rules = (req.result as CategorizationRule[]) || [];
        if (activeOnly) {
          rules = rules.filter((r) => r.isActive);
        }
        // Sort by priority ascending (lower number = higher priority), then alphabetically by name
        rules.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
        resolve(rules);
      };
      req.onerror = () =>
        reject(new StorageError("Failed to fetch categorization rules", "PERSISTENCE_FAILED", req.error));
    });
  }

  async getByCategory(categoryId: ID): Promise<CategorizationRule[]> {
    const db = await this.dbPromise;
    return new Promise<CategorizationRule[]>((resolve, reject) => {
      const tx = db.transaction("categorization_rules", "readonly");
      const store = tx.objectStore("categorization_rules");
      const index = store.index("categoryId");
      const req = index.getAll(categoryId);

      req.onsuccess = () => {
        const rules = (req.result as CategorizationRule[]) || [];
        rules.sort((a, b) => a.priority - b.priority);
        resolve(rules);
      };
      req.onerror = () =>
        reject(
          new StorageError(`Failed to fetch rules for category ${categoryId}`, "PERSISTENCE_FAILED", req.error)
        );
    });
  }

  async save(rule: CategorizationRule): Promise<void> {
    const validated = validateCategorizationRule(rule);
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("categorization_rules", "readwrite");
      const store = tx.objectStore("categorization_rules");
      const req = store.put(validated);

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(new StorageError(`Failed to save categorization rule ${rule.id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async delete(id: ID): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("categorization_rules", "readwrite");
      const store = tx.objectStore("categorization_rules");
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () =>
        reject(new StorageError(`Failed to delete categorization rule ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async seedDefaults(): Promise<void> {
    const db = await this.dbPromise;
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("categorization_rules", "readwrite");
      const store = tx.objectStore("categorization_rules");

      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(new StorageError("Failed to seed default categorization rules", "PERSISTENCE_FAILED", tx.error));

      for (const rule of DEFAULT_CATEGORIZATION_RULES) {
        store.put(rule);
      }
    });
  }
}

