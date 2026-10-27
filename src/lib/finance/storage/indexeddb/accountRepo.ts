/**
 * Life Atlas Finance: IndexedDB Account Repository
 */

import { IFinanceAccountRepository } from "../interfaces";
import { FinanceAccount, ID, AccountStatus } from "../../domain/models";
import { validateFinanceAccount } from "../../domain/validation";
import { StorageError } from "../../domain/errors";
import { getFinanceDB } from "./database";

export class IndexedDBAccountRepository implements IFinanceAccountRepository {
  private dbPromise: Promise<IDBDatabase>;

  constructor(customDbPromise?: Promise<IDBDatabase>) {
    this.dbPromise = customDbPromise || getFinanceDB();
  }

  async getById(id: ID): Promise<FinanceAccount | null> {
    const db = await this.dbPromise;
    return new Promise<FinanceAccount | null>((resolve, reject) => {
      const tx = db.transaction("accounts", "readonly");
      const store = tx.objectStore("accounts");
      const req = store.get(id);

      req.onsuccess = () => {
        resolve(req.result ? (req.result as FinanceAccount) : null);
      };
      req.onerror = () => {
        reject(new StorageError(`Failed to fetch account ${id}`, "PERSISTENCE_FAILED", req.error));
      };
    });
  }

  async getAll(status?: AccountStatus): Promise<FinanceAccount[]> {
    const db = await this.dbPromise;
    return new Promise<FinanceAccount[]>((resolve, reject) => {
      const tx = db.transaction("accounts", "readonly");
      const store = tx.objectStore("accounts");

      let req: IDBRequest;
      if (status) {
        const index = store.index("status");
        req = index.getAll(status);
      } else {
        req = store.getAll();
      }

      req.onsuccess = () => {
        const accounts = (req.result as FinanceAccount[]) || [];
        // Sort by createdAt descending
        accounts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        resolve(accounts);
      };
      req.onerror = () => {
        reject(new StorageError("Failed to fetch accounts", "PERSISTENCE_FAILED", req.error));
      };
    });
  }

  async save(account: FinanceAccount): Promise<void> {
    const validated = validateFinanceAccount(account);
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("accounts", "readwrite");
      const store = tx.objectStore("accounts");
      const req = store.put(validated);

      req.onsuccess = () => resolve();
      req.onerror = () => {
        reject(new StorageError(`Failed to save account ${account.id}`, "PERSISTENCE_FAILED", req.error));
      };
    });
  }

  async updateBalance(id: ID, newBalancePaise: number): Promise<void> {
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("accounts", "readwrite");
      const store = tx.objectStore("accounts");
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const acc = getReq.result as FinanceAccount | undefined;
        if (!acc) {
          reject(new StorageError(`Cannot update balance: Account ${id} not found`, "INVALID_ACCOUNT"));
          return;
        }

        acc.currentBalancePaise = newBalancePaise;
        acc.updatedAt = new Date().toISOString();
        acc.version = (acc.version || 1) + 1;

        const putReq = store.put(acc);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(new StorageError(`Failed to update balance for ${id}`, "PERSISTENCE_FAILED", putReq.error));
      };

      getReq.onerror = () => {
        reject(new StorageError(`Failed to get account ${id} for balance update`, "PERSISTENCE_FAILED", getReq.error));
      };
    });
  }

  async archive(id: ID): Promise<void> {
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("accounts", "readwrite");
      const store = tx.objectStore("accounts");
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const acc = getReq.result as FinanceAccount | undefined;
        if (!acc) {
          reject(new StorageError(`Cannot archive: Account ${id} not found`, "INVALID_ACCOUNT"));
          return;
        }

        acc.status = "archived";
        acc.updatedAt = new Date().toISOString();
        acc.version = (acc.version || 1) + 1;

        const putReq = store.put(acc);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(new StorageError(`Failed to archive account ${id}`, "PERSISTENCE_FAILED", putReq.error));
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  async delete(id: ID): Promise<void> {
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("accounts", "readwrite");
      const store = tx.objectStore("accounts");
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(new StorageError(`Failed to delete account ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }
}

