/**
 * Life Atlas Finance: IndexedDB Budget Repository
 */

import { IBudgetRepository } from "../interfaces";
import { Budget, ID } from "../../domain/models";
import { validateBudget } from "../../domain/validation";
import { StorageError } from "../../domain/errors";
import { getFinanceDB } from "./database";

export class IndexedDBBudgetRepository implements IBudgetRepository {
  private dbPromise: Promise<IDBDatabase>;

  constructor(customDbPromise?: Promise<IDBDatabase>) {
    this.dbPromise = customDbPromise || getFinanceDB();
  }

  async getById(id: ID): Promise<Budget | null> {
    const db = await this.dbPromise;
    return new Promise<Budget | null>((resolve, reject) => {
      const tx = db.transaction("budgets", "readonly");
      const store = tx.objectStore("budgets");
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result ? (req.result as Budget) : null);
      req.onerror = () => reject(new StorageError(`Failed to get budget ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async getAll(): Promise<Budget[]> {
    const db = await this.dbPromise;
    return new Promise<Budget[]>((resolve, reject) => {
      const tx = db.transaction("budgets", "readonly");
      const store = tx.objectStore("budgets");
      const req = store.getAll();

      req.onsuccess = () => {
        const budgets = (req.result as Budget[]) || [];
        budgets.sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
        resolve(budgets);
      };
      req.onerror = () => reject(new StorageError("Failed to fetch budgets", "PERSISTENCE_FAILED", req.error));
    });
  }

  async getByPeriod(period: string, startDate?: string): Promise<Budget[]> {
    const db = await this.dbPromise;
    return new Promise<Budget[]>((resolve, reject) => {
      const tx = db.transaction("budgets", "readonly");
      const store = tx.objectStore("budgets");
      const index = store.index("period");
      const req = index.getAll(period);

      req.onsuccess = () => {
        let budgets = (req.result as Budget[]) || [];
        if (startDate) {
          budgets = budgets.filter((b) => b.startDate === startDate);
        }
        resolve(budgets);
      };
      req.onerror = () => reject(new StorageError("Failed to fetch budgets by period", "PERSISTENCE_FAILED", req.error));
    });
  }

  async save(budget: Budget): Promise<void> {
    const validated = validateBudget(budget);
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("budgets", "readwrite");
      const store = tx.objectStore("budgets");
      const req = store.put(validated);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(new StorageError(`Failed to save budget ${budget.id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async delete(id: ID): Promise<void> {
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("budgets", "readwrite");
      const store = tx.objectStore("budgets");
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(new StorageError(`Failed to delete budget ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }
}

