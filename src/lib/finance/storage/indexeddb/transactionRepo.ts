/**
 * Life Atlas Finance: IndexedDB Transaction Repository
 * 
 * High-performance transaction queries with compound filtering, date range indexing,
 * full text description search, and batch persistence.
 */

import { ITransactionRepository, TransactionFilterOptions } from "../interfaces";
import { Transaction, ID } from "../../domain/models";
import { validateTransaction } from "../../domain/validation";
import { StorageError } from "../../domain/errors";
import { getFinanceDB } from "./database";

export class IndexedDBTransactionRepository implements ITransactionRepository {
  private dbPromise: Promise<IDBDatabase>;

  constructor(customDbPromise?: Promise<IDBDatabase>) {
    this.dbPromise = customDbPromise || getFinanceDB();
  }

  async getById(id: ID): Promise<Transaction | null> {
    const db = await this.dbPromise;
    return new Promise<Transaction | null>((resolve, reject) => {
      const tx = db.transaction("transactions", "readonly");
      const store = tx.objectStore("transactions");
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result ? (req.result as Transaction) : null);
      req.onerror = () => reject(new StorageError(`Failed to get transaction ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async getByExternalId(externalId: string): Promise<Transaction | null> {
    const db = await this.dbPromise;
    return new Promise<Transaction | null>((resolve, reject) => {
      const tx = db.transaction("transactions", "readonly");
      const store = tx.objectStore("transactions");
      const index = store.index("externalId");
      const req = index.get(externalId);

      req.onsuccess = () => resolve(req.result ? (req.result as Transaction) : null);
      req.onerror = () => reject(new StorageError(`Failed to get transaction by external ID ${externalId}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async getByTransferGroupId(transferGroupId: ID): Promise<Transaction[]> {
    const db = await this.dbPromise;
    return new Promise<Transaction[]>((resolve, reject) => {
      const tx = db.transaction("transactions", "readonly");
      const store = tx.objectStore("transactions");
      const index = store.index("transferGroupId");
      const req = index.getAll(transferGroupId);

      req.onsuccess = () => resolve((req.result as Transaction[]) || []);
      req.onerror = () => reject(new StorageError(`Failed to get transactions for transfer ${transferGroupId}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async query(filters: TransactionFilterOptions): Promise<Transaction[]> {
    const db = await this.dbPromise;

    return new Promise<Transaction[]>((resolve, reject) => {
      const tx = db.transaction("transactions", "readonly");
      const store = tx.objectStore("transactions");

      let req: IDBRequest;

      // Utilize index where applicable
      if (filters.accountId) {
        const index = store.index("accountId");
        req = index.getAll(filters.accountId);
      } else if (filters.categoryId) {
        const index = store.index("categoryId");
        req = index.getAll(filters.categoryId);
      } else if (filters.transferGroupId) {
        const index = store.index("transferGroupId");
        req = index.getAll(filters.transferGroupId);
      } else {
        req = store.getAll();
      }

      req.onsuccess = () => {
        let results = (req.result as Transaction[]) || [];

        // Apply in-memory secondary filters
        if (filters.accountIds && filters.accountIds.length > 0) {
          const set = new Set(filters.accountIds);
          results = results.filter((t) => set.has(t.accountId));
        }

        if (filters.categoryIds && filters.categoryIds.length > 0) {
          const set = new Set(filters.categoryIds);
          results = results.filter((t) => t.categoryId && set.has(t.categoryId));
        }

        if (filters.startDate) {
          const startTime = Date.parse(filters.startDate);
          results = results.filter((t) => Date.parse(t.occurredAt) >= startTime);
        }

        if (filters.endDate) {
          const endTime = Date.parse(filters.endDate);
          results = results.filter((t) => Date.parse(t.occurredAt) <= endTime);
        }

        if (filters.status) {
          results = results.filter((t) => t.status === filters.status);
        }

        if (filters.direction) {
          results = results.filter((t) => t.direction === filters.direction);
        }

        if (filters.source) {
          results = results.filter((t) => t.source === filters.source);
        }

        if (filters.minAmountPaise !== undefined) {
          results = results.filter((t) => t.amountPaise >= (filters.minAmountPaise || 0));
        }

        if (filters.maxAmountPaise !== undefined) {
          results = results.filter((t) => t.amountPaise <= (filters.maxAmountPaise || 0));
        }

        if (filters.searchQuery && filters.searchQuery.trim()) {
          const q = filters.searchQuery.trim().toLowerCase();
          results = results.filter(
            (t) =>
              t.description.toLowerCase().includes(q) ||
              (t.merchant && t.merchant.toLowerCase().includes(q)) ||
              (t.notes && t.notes.toLowerCase().includes(q))
          );
        }

        // Sort chronologically descending (newest first)
        results.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

        // Pagination
        if (filters.offset || filters.limit) {
          const offset = filters.offset || 0;
          const limit = filters.limit ? offset + filters.limit : results.length;
          results = results.slice(offset, limit);
        }

        resolve(results);
      };

      req.onerror = () => {
        reject(new StorageError("Failed to query transactions", "PERSISTENCE_FAILED", req.error));
      };
    });
  }

  async count(filters: TransactionFilterOptions): Promise<number> {
    const list = await this.query({ ...filters, limit: undefined, offset: undefined });
    return list.length;
  }

  async save(transaction: Transaction): Promise<void> {
    const validated = validateTransaction(transaction);
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("transactions", "readwrite");
      const store = tx.objectStore("transactions");
      const req = store.put(validated);

      req.onsuccess = () => resolve();
      req.onerror = () => {
        reject(new StorageError(`Failed to save transaction ${transaction.id}`, "PERSISTENCE_FAILED", req.error));
      };
    });
  }

  async saveBatch(transactions: Transaction[]): Promise<void> {
    if (transactions.length === 0) return;
    const validated = transactions.map(validateTransaction);
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("transactions", "readwrite");
      const store = tx.objectStore("transactions");

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new StorageError("Failed to batch save transactions", "PERSISTENCE_FAILED", tx.error));
      tx.onabort = () => reject(new StorageError("Transaction aborted during batch save", "PERSISTENCE_FAILED", tx.error));

      for (const t of validated) {
        store.put(t);
      }
    });
  }

  async delete(id: ID): Promise<void> {
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("transactions", "readwrite");
      const store = tx.objectStore("transactions");
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(new StorageError(`Failed to delete transaction ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }
}

