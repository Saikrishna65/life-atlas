/**
 * Life Atlas Finance: IndexedDB Category Repository
 */

import { IFinanceCategoryRepository } from "../interfaces";
import { FinanceCategory, ID } from "../../domain/models";
import { validateFinanceCategory } from "../../domain/validation";
import { StorageError } from "../../domain/errors";
import { DEFAULT_FINANCE_CATEGORIES } from "./migrations";
import { getFinanceDB } from "./database";

export class IndexedDBCategoryRepository implements IFinanceCategoryRepository {
  private dbPromise: Promise<IDBDatabase>;

  constructor(customDbPromise?: Promise<IDBDatabase>) {
    this.dbPromise = customDbPromise || getFinanceDB();
  }

  async getById(id: ID): Promise<FinanceCategory | null> {
    const db = await this.dbPromise;
    return new Promise<FinanceCategory | null>((resolve, reject) => {
      const tx = db.transaction("categories", "readonly");
      const store = tx.objectStore("categories");
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result ? (req.result as FinanceCategory) : null);
      req.onerror = () => reject(new StorageError(`Failed to get category ${id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async getAll(): Promise<FinanceCategory[]> {
    const db = await this.dbPromise;
    return new Promise<FinanceCategory[]>((resolve, reject) => {
      const tx = db.transaction("categories", "readonly");
      const store = tx.objectStore("categories");
      const req = store.getAll();

      req.onsuccess = () => {
        const categories = (req.result as FinanceCategory[]) || [];
        categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        resolve(categories);
      };
      req.onerror = () => reject(new StorageError("Failed to fetch categories", "PERSISTENCE_FAILED", req.error));
    });
  }

  async save(category: FinanceCategory): Promise<void> {
    const validated = validateFinanceCategory(category);
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("categories", "readwrite");
      const store = tx.objectStore("categories");
      const req = store.put(validated);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(new StorageError(`Failed to save category ${category.id}`, "PERSISTENCE_FAILED", req.error));
    });
  }

  async delete(id: ID): Promise<void> {
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("categories", "readwrite");
      const store = tx.objectStore("categories");
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const cat = getReq.result as FinanceCategory | undefined;
        if (cat?.isSystem) {
          reject(new StorageError("System categories cannot be deleted", "CATEGORY_IN_USE"));
          return;
        }

        const delReq = store.delete(id);
        delReq.onsuccess = () => resolve();
        delReq.onerror = () => reject(new StorageError(`Failed to delete category ${id}`, "PERSISTENCE_FAILED", delReq.error));
      };

      getReq.onerror = () => reject(getReq.error);
    });
  }

  async seedDefaults(): Promise<void> {
    const db = await this.dbPromise;

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("categories", "readwrite");
      const store = tx.objectStore("categories");

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new StorageError("Failed to seed default categories", "PERSISTENCE_FAILED", tx.error));

      for (const cat of DEFAULT_FINANCE_CATEGORIES) {
        store.put(cat);
      }
    });
  }
}

