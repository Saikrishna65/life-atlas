/**
 * Life Atlas Finance: IndexedDB Savings Goal Repository
 */

import { ISavingsGoalRepository } from "../interfaces";
import { SavingsGoal, ID } from "../../domain/models";
import { validateSavingsGoal } from "../../domain/validation";
import { StorageError } from "../../domain/errors";
import { getFinanceDB } from "./database";

export class IndexedDBSavingsGoalRepository implements ISavingsGoalRepository {
  private dbPromise: Promise<IDBDatabase>;

  constructor(customDbPromise?: Promise<IDBDatabase>) {
    this.dbPromise = customDbPromise || getFinanceDB();
  }

  async getById(id: ID): Promise<SavingsGoal | null> {
    const db = await this.dbPromise;
    return new Promise<SavingsGoal | null>((resolve, reject) => {
      const tx = db.transaction("savings_goals", "readonly");
      const store = tx.objectStore("savings_goals");
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result ? (req.result as SavingsGoal) : null);
      req.onerror = () => reject(new StorageError(`Failed to get savings goal ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async getAll(): Promise<SavingsGoal[]> {
    const db = await this.dbPromise;
    return new Promise<SavingsGoal[]>((resolve, reject) => {
      const tx = db.transaction("savings_goals", "readonly");
      const store = tx.objectStore("savings_goals");
      const req = store.getAll();

      req.onsuccess = () => {
        const goals = (req.result as SavingsGoal[]) || [];
        goals.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        resolve(goals);
      };
      req.onerror = () => reject(new StorageError("Failed to fetch savings goals", "PERSISTENCE_FAILED", req.error));
    });
  }

  async save(goal: SavingsGoal): Promise<void> {
    const validated = validateSavingsGoal(goal);
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("savings_goals", "readwrite");
      const store = tx.objectStore("savings_goals");
      const req = store.put(validated);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(new StorageError(`Failed to save savings goal ${goal.id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async delete(id: ID): Promise<void> {
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("savings_goals", "readwrite");
      const store = tx.objectStore("savings_goals");
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(new StorageError(`Failed to delete savings goal ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }
}

