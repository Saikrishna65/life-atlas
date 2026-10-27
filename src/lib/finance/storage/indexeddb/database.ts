/**
 * Life Atlas Finance: IndexedDB Connection Manager
 * 
 * Database: life_atlas_finance_db
 * Completely isolated from life_atlas_trip_vault_db and life_atlas_music_db.
 */

import { StorageError } from "../../domain/errors";
import { FINANCE_DB_NAME, FINANCE_DB_VERSION, migrateToV1, migrateToV2, migrateToV3, migrateToV4 } from "./migrations";

let cachedDB: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

function getIndexedDBFactory(): IDBFactory {
  if (typeof window !== "undefined" && window.indexedDB) {
    return window.indexedDB;
  }
  if (typeof globalThis !== "undefined" && globalThis.indexedDB) {
    return globalThis.indexedDB;
  }
  throw new StorageError(
    "IndexedDB is unavailable in this runtime environment.",
    "STORAGE_UNAVAILABLE"
  );
}

/**
 * Checks whether IndexedDB is functional in the current environment
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return !!getIndexedDBFactory();
  } catch {
    return false;
  }
}

/**
 * Opens or retrieves the cached Finance IndexedDB connection
 */
export async function getFinanceDB(): Promise<IDBDatabase> {
  if (cachedDB) return cachedDB;
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const factory = getIndexedDBFactory();
      const request = factory.open(FINANCE_DB_NAME, FINANCE_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        const oldVersion = event.oldVersion;

        if (transaction) {
          if (oldVersion < 1) {
            migrateToV1(db, transaction);
          }
          if (oldVersion < 2) {
            migrateToV2(db, transaction);
          }
          if (oldVersion < 3) {
            migrateToV3(db, transaction);
          }
          if (oldVersion < 4) {
            migrateToV4(db, transaction);
          }
        }
      };

      request.onsuccess = (event) => {
        cachedDB = (event.target as IDBOpenDBRequest).result;
        cachedDB.onclose = () => {
          cachedDB = null;
          dbOpenPromise = null;
        };
        dbOpenPromise = null;
        resolve(cachedDB);
      };

      request.onerror = () => {
        dbOpenPromise = null;
        reject(
          new StorageError(
            `Failed to open finance database: ${request.error?.message || "Unknown error"}`,
            "PERSISTENCE_FAILED",
            request.error
          )
        );
      };

      request.onblocked = () => {
        console.warn("Finance IndexedDB open blocked by existing connection");
      };
    } catch (err) {
      dbOpenPromise = null;
      reject(
        new StorageError(
          "Exception occurred while initiating IndexedDB connection",
          "STORAGE_UNAVAILABLE",
          err
        )
      );
    }
  });

  return dbOpenPromise;
}

/**
 * Closes the cached database connection
 */
export async function closeFinanceDB(): Promise<void> {
  if (cachedDB) {
    cachedDB.close();
    cachedDB = null;
  }
  dbOpenPromise = null;
}

/**
 * Deletes the entire finance database (primarily for automated testing)
 */
export async function deleteFinanceDB(): Promise<void> {
  await closeFinanceDB();
  return new Promise<void>((resolve, reject) => {
    try {
      const factory = getIndexedDBFactory();
      const request = factory.deleteDatabase(FINANCE_DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    } catch (err) {
      reject(err);
    }
  });
}

