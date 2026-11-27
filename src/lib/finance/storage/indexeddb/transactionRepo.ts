import { selectTransactions } from "../../domain/transactionQuery";
/**
 * Atlas Finance: IndexedDB Transaction Repository
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
        const results = selectTransactions((req.result as Transaction[]) || [], filters);
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

  async saveIfVersion(transaction: Transaction, expectedVersion: number): Promise<boolean> {
    validateTransaction(transaction);
    const db=await this.dbPromise;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction("transactions","readwrite");const store=tx.objectStore("transactions");let saved=false;
      const request=store.get(transaction.id);
      request.onsuccess=()=>{if(request.result?.version===expectedVersion){store.put(transaction);saved=true;}};
      tx.oncomplete=()=>resolve(saved);tx.onerror=()=>reject(new StorageError("Failed to save trip assignment","PERSISTENCE_FAILED",tx.error));
      tx.onabort=()=>reject(new StorageError("Trip assignment was interrupted","PERSISTENCE_FAILED",tx.error));
    });
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

