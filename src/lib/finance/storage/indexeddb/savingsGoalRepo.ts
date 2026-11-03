/**
 * Life Atlas Finance: IndexedDB Savings Goal Repository
 */

import { ISavingsGoalRepository } from "../interfaces";
import { SavingsGoal, ID } from "../../domain/models";
import { validateSavingsGoal } from "../../domain/validation";
import { StorageError } from "../../domain/errors";
import { getFinanceDB } from "./database";

function normalizeGoal(raw: any): SavingsGoal {
  if (!raw) return raw;
  const isLegacy = raw.allocatedPaise === undefined && (raw.isLegacyGoal === undefined || raw.isLegacyGoal === true);
  const currentAmount = raw.currentAmountPaise ?? raw.allocatedPaise ?? 0;
  return {
    ...raw,
    allocatedPaise: raw.allocatedPaise ?? (raw.linkedAccountId ? currentAmount : 0),
    currentAmountPaise: currentAmount,
    legacyTrackedPaise: raw.legacyTrackedPaise ?? (isLegacy ? currentAmount : undefined),
    isLegacyGoal: isLegacy,
    history: Array.isArray(raw.history) ? raw.history : [],
    status: raw.status || "active",
  };
}

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

      req.onsuccess = () => resolve(req.result ? normalizeGoal(req.result) : null);
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
        const goals = ((req.result as SavingsGoal[]) || []).map(normalizeGoal);
        goals.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        resolve(goals);
      };
      req.onerror = () => reject(new StorageError("Failed to fetch savings goals", "PERSISTENCE_FAILED", req.error));
    });
  }

  async getByAccountId(accountId: ID): Promise<SavingsGoal[]> {
    const all = await this.getAll();
    return all.filter((g) => g.linkedAccountId === accountId);
  }

  async save(goal: SavingsGoal): Promise<void> {
    const normalized = normalizeGoal(goal);
    const validated = validateSavingsGoal(normalized);
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

