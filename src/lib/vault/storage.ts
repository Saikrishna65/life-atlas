/**
 * Life Atlas: Android Trip Vault Native IndexedDB Storage Engine
 * Zero-dependency, offline-first local persistence supporting all 10 object stores.
 */

import {
  VaultStoreName,
  VaultStoreMap,
  TripRecord,
  TripStatus,
  ItineraryDayRecord,
  BookingRecord,
  DocumentAttachmentRecord,
  VehicleRentalRecord,
  FoodPlannerRecord,
  ExpenseRecord,
  PackingItemRecord,
  SafetyContactRecord,
  ReminderRecord,
  WaypointRecord,
  RouteSegment,
  MedicalCardInfo,
  ContingencyPlan,
  TripMemoryRecord,
  ID,
} from "./types";

export const VAULT_DB_NAME = "life_atlas_trip_vault_db";
export const VAULT_DB_VERSION = 1;

export const ALL_VAULT_STORES: VaultStoreName[] = [
  "trips",
  "itineraries",
  "bookings",
  "documents",
  "rentals",
  "food_items",
  "expenses",
  "packing_items",
  "safety_contacts",
  "reminders",
];

// -----------------------------------------------------------------------------
// Typed Storage Error
// -----------------------------------------------------------------------------

export type VaultStorageErrorCode =
  | "STORAGE_UNAVAILABLE"
  | "QUOTA_EXCEEDED"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "TRANSACTION_FAILED"
  | "CORRUPT_RECORD"
  | "UNKNOWN_ERROR";

export class VaultStorageError extends Error {
  code: VaultStorageErrorCode;
  originalError?: unknown;

  constructor(message: string, code: VaultStorageErrorCode, originalError?: unknown) {
    super(message);
    this.name = "VaultStorageError";
    this.code = code;
    this.originalError = originalError;
  }
}

// -----------------------------------------------------------------------------
// Database Connection Manager
// -----------------------------------------------------------------------------

let dbInstance: IDBDatabase | null = null;
let openPromise: Promise<IDBDatabase> | null = null;

function getIndexedDBFactory(): IDBFactory {
  if (typeof window !== "undefined" && window.indexedDB) {
    return window.indexedDB;
  }
  if (typeof globalThis !== "undefined" && globalThis.indexedDB) {
    return globalThis.indexedDB;
  }
  throw new VaultStorageError(
    "IndexedDB is unavailable in this environment.",
    "STORAGE_UNAVAILABLE"
  );
}

/**
 * Checks whether IndexedDB is available and functional in the current environment
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return !!getIndexedDBFactory();
  } catch {
    return false;
  }
}

/**
 * Opens or retrieves the active singleton IDBDatabase connection.
 * Guarantees serial execution of open requests to prevent race conditions.
 */
export function getVaultDB(customFactory?: IDBFactory): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (openPromise) {
    return openPromise;
  }

  const factory = customFactory || getIndexedDBFactory();

  openPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = factory.open(VAULT_DB_NAME, VAULT_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = event.oldVersion;

        // Version 1 Upgrade: Initialize all 10 stores and primary indexes
        if (oldVersion < 1) {
          // 1. Trips Store
          if (!db.objectStoreNames.contains("trips")) {
            const tripStore = db.createObjectStore("trips", { keyPath: "id" });
            tripStore.createIndex("by-status", "status", { unique: false });
            tripStore.createIndex("by-startDate", "startDate", { unique: false });
            tripStore.createIndex("by-destination", "destination", { unique: false });
          }

          // 2. Itineraries Store
          if (!db.objectStoreNames.contains("itineraries")) {
            const itinStore = db.createObjectStore("itineraries", { keyPath: "id" });
            itinStore.createIndex("by-tripId", "tripId", { unique: false });
            itinStore.createIndex("by-tripId-dayIndex", ["tripId", "dayIndex"], { unique: true });
          }

          // 3. Bookings Store
          if (!db.objectStoreNames.contains("bookings")) {
            const bkgStore = db.createObjectStore("bookings", { keyPath: "id" });
            bkgStore.createIndex("by-tripId", "tripId", { unique: false });
            bkgStore.createIndex("by-tripId-category", ["tripId", "category"], { unique: false });
            bkgStore.createIndex("by-pnr", "pnrNumber", { unique: false });
          }

          // 4. Documents Store (Binary PDF & Image Attachments)
          if (!db.objectStoreNames.contains("documents")) {
            const docStore = db.createObjectStore("documents", { keyPath: "id" });
            docStore.createIndex("by-tripId", "tripId", { unique: false });
            docStore.createIndex("by-tripId-bookingId", ["tripId", "bookingId"], { unique: false });
          }

          // 5. Rentals Store (Bikes, Scooters, Cars)
          if (!db.objectStoreNames.contains("rentals")) {
            const rntStore = db.createObjectStore("rentals", { keyPath: "id" });
            rntStore.createIndex("by-tripId", "tripId", { unique: false });
          }

          // 6. Food Items Store
          if (!db.objectStoreNames.contains("food_items")) {
            const foodStore = db.createObjectStore("food_items", { keyPath: "id" });
            foodStore.createIndex("by-tripId", "tripId", { unique: false });
            foodStore.createIndex("by-tripId-type", ["tripId", "type"], { unique: false });
            foodStore.createIndex("by-tripId-mealSlot", ["tripId", "mealSlot"], { unique: false });
          }

          // 7. Expenses Store
          if (!db.objectStoreNames.contains("expenses")) {
            const expStore = db.createObjectStore("expenses", { keyPath: "id" });
            expStore.createIndex("by-tripId", "tripId", { unique: false });
            expStore.createIndex("by-tripId-category", ["tripId", "category"], { unique: false });
            expStore.createIndex("by-tripId-date", ["tripId", "date"], { unique: false });
          }

          // 8. Packing Items Store
          if (!db.objectStoreNames.contains("packing_items")) {
            const pckStore = db.createObjectStore("packing_items", { keyPath: "id" });
            pckStore.createIndex("by-tripId", "tripId", { unique: false });
            pckStore.createIndex("by-tripId-category", ["tripId", "category"], { unique: false });
          }

          // 9. Safety Contacts Store
          if (!db.objectStoreNames.contains("safety_contacts")) {
            const sftStore = db.createObjectStore("safety_contacts", { keyPath: "id" });
            sftStore.createIndex("by-tripId", "tripId", { unique: false });
          }

          // 10. Reminders Store
          if (!db.objectStoreNames.contains("reminders")) {
            const remStore = db.createObjectStore("reminders", { keyPath: "id" });
            remStore.createIndex("by-tripId", "tripId", { unique: false });
            remStore.createIndex("by-triggerTime", "triggerTime", { unique: false });
          }
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        dbInstance = db;

        db.onversionchange = () => {
          db.close();
          dbInstance = null;
        };

        db.onclose = () => {
          dbInstance = null;
        };

        resolve(db);
      };

      request.onerror = () => {
        openPromise = null;
        reject(
          new VaultStorageError(
            `Failed to open IndexedDB '${VAULT_DB_NAME}': ${request.error?.message || "Unknown error"}`,
            "STORAGE_UNAVAILABLE",
            request.error
          )
        );
      };

      request.onblocked = () => {
        openPromise = null;
        reject(
          new VaultStorageError(
            `Database open blocked by another active tab.`,
            "TRANSACTION_FAILED"
          )
        );
      };
    } catch (err) {
      openPromise = null;
      reject(
        new VaultStorageError(
          `Exception initializing IndexedDB: ${String(err)}`,
          "STORAGE_UNAVAILABLE",
          err
        )
      );
    }
  }).finally(() => {
    openPromise = null;
  });

  return openPromise;
}

/**
 * Closes the active database connection and resets cached instances
 */
export function closeVaultDB(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Ignore closing errors
    }
    dbInstance = null;
  }
}

/**
 * Completely drops the local vault database (useful for data resets or isolated testing)
 */
export function deleteVaultDB(customFactory?: IDBFactory): Promise<void> {
  closeVaultDB();
  const factory = customFactory || getIndexedDBFactory();

  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(VAULT_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(
        new VaultStorageError(
          `Failed to delete database: ${request.error?.message}`,
          "TRANSACTION_FAILED",
          request.error
        )
      );
    request.onblocked = () =>
      reject(
        new VaultStorageError(
          `Database deletion blocked by open connection.`,
          "TRANSACTION_FAILED"
        )
      );
  });
}

// -----------------------------------------------------------------------------
// Generic Low-Level IndexedDB Operations
// -----------------------------------------------------------------------------

function mapDOMException(error: DOMException | null): VaultStorageError {
  if (!error) return new VaultStorageError("Unknown database failure", "UNKNOWN_ERROR");

  if (error.name === "QuotaExceededError") {
    return new VaultStorageError(
      "Local device storage quota exceeded. Free up space or remove large attachments.",
      "QUOTA_EXCEEDED",
      error
    );
  }
  if (error.name === "ConstraintError") {
    return new VaultStorageError(
      `Constraint violation: ${error.message}`,
      "ALREADY_EXISTS",
      error
    );
  }
  if (error.name === "NotFoundError") {
    return new VaultStorageError(
      `Record or store not found: ${error.message}`,
      "NOT_FOUND",
      error
    );
  }

  return new VaultStorageError(
    `IndexedDB transaction error (${error.name}): ${error.message}`,
    "TRANSACTION_FAILED",
    error
  );
}

/**
 * Inserts or updates a record in the specified store
 */
export async function putRecord<K extends VaultStoreName>(
  storeName: K,
  record: VaultStoreMap[K]
): Promise<VaultStoreMap[K]> {
  const db = await getVaultDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.put(record);

      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(mapDOMException(request.error));
      tx.onabort = () => reject(mapDOMException(tx.error));
    } catch (err) {
      reject(new VaultStorageError(`Failed to put record in '${storeName}'`, "TRANSACTION_FAILED", err));
    }
  });
}

/**
 * Inserts a record only if the key does not already exist, preventing accidental overwrite
 */
export async function addRecord<K extends VaultStoreName>(
  storeName: K,
  record: VaultStoreMap[K]
): Promise<VaultStoreMap[K]> {
  const db = await getVaultDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.add(record);

      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(mapDOMException(request.error));
      tx.onabort = () => reject(mapDOMException(tx.error));
    } catch (err) {
      reject(new VaultStorageError(`Failed to add record to '${storeName}'`, "TRANSACTION_FAILED", err));
    }
  });
}

/**
 * Fetches a single record by its primary key
 */
export async function getRecord<K extends VaultStoreName>(
  storeName: K,
  id: ID
): Promise<VaultStoreMap[K] | null> {
  const db = await getVaultDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(mapDOMException(request.error));
      tx.onabort = () => reject(mapDOMException(tx.error));
    } catch (err) {
      reject(new VaultStorageError(`Failed to get record from '${storeName}'`, "TRANSACTION_FAILED", err));
    }
  });
}

/**
 * Retrieves all records from a given store
 */
export async function getAllRecords<K extends VaultStoreName>(
  storeName: K
): Promise<VaultStoreMap[K][]> {
  const db = await getVaultDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(mapDOMException(request.error));
      tx.onabort = () => reject(mapDOMException(tx.error));
    } catch (err) {
      reject(new VaultStorageError(`Failed to get all records from '${storeName}'`, "TRANSACTION_FAILED", err));
    }
  });
}

/**
 * Queries records using an index
 */
export async function getRecordsByIndex<K extends VaultStoreName>(
  storeName: K,
  indexName: string,
  queryValue: IDBValidKey | IDBKeyRange
): Promise<VaultStoreMap[K][]> {
  const db = await getVaultDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);

      if (!store.indexNames.contains(indexName)) {
        reject(
          new VaultStorageError(
            `Index '${indexName}' does not exist on store '${storeName}'`,
            "NOT_FOUND"
          )
        );
        return;
      }

      const index = store.index(indexName);
      const request = index.getAll(queryValue);

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(mapDOMException(request.error));
      tx.onabort = () => reject(mapDOMException(tx.error));
    } catch (err) {
      reject(
        new VaultStorageError(
          `Failed querying index '${indexName}' on '${storeName}'`,
          "TRANSACTION_FAILED",
          err
        )
      );
    }
  });
}

/**
 * Deletes a record by ID
 */
export async function deleteRecord<K extends VaultStoreName>(
  storeName: K,
  id: ID
): Promise<boolean> {
  const db = await getVaultDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(mapDOMException(request.error));
      tx.onabort = () => reject(mapDOMException(tx.error));
    } catch (err) {
      reject(new VaultStorageError(`Failed to delete record from '${storeName}'`, "TRANSACTION_FAILED", err));
    }
  });
}

/**
 * Counts total records in a store
 */
export async function countRecords(storeName: VaultStoreName): Promise<number> {
  const db = await getVaultDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(mapDOMException(request.error));
      tx.onabort = () => reject(mapDOMException(tx.error));
    } catch (err) {
      reject(new VaultStorageError(`Failed counting records in '${storeName}'`, "TRANSACTION_FAILED", err));
    }
  });
}

/**
 * Clears all records from a given store
 */
export async function clearStore(storeName: VaultStoreName): Promise<void> {
  const db = await getVaultDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(mapDOMException(request.error));
      tx.onabort = () => reject(mapDOMException(tx.error));
    } catch (err) {
      reject(new VaultStorageError(`Failed clearing store '${storeName}'`, "TRANSACTION_FAILED", err));
    }
  });
}

// -----------------------------------------------------------------------------
// High-Level Domain Operations (Typed APIs for the 10 Stores)
// -----------------------------------------------------------------------------

// --- Store 1: Trips ---

export async function saveTrip(trip: TripRecord): Promise<TripRecord> {
  const updated: TripRecord = {
    ...trip,
    updatedAt: new Date().toISOString(),
  };
  return putRecord("trips", updated);
}

export async function getTrip(tripId: ID): Promise<TripRecord | null> {
  return getRecord("trips", tripId);
}

export async function getAllTrips(): Promise<TripRecord[]> {
  const trips = await getAllRecords("trips");
  // Sort descending by startDate
  return trips.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

export async function getTripsByStatus(status: TripStatus): Promise<TripRecord[]> {
  return getRecordsByIndex("trips", "by-status", status);
}

/**
 * Deletes a trip and cascades deletion across all 9 child stores in a single atomic transaction.
 * Guarantees zero orphaned bookings, documents, or itineraries.
 */
export async function deleteTripCascade(tripId: ID): Promise<boolean> {
  const db = await getVaultDB();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(ALL_VAULT_STORES, "readwrite");

      // 1. Delete main trip record
      tx.objectStore("trips").delete(tripId);

      // 2. Cascade delete from all 9 child stores using their "by-tripId" index
      const childStores: VaultStoreName[] = [
        "itineraries",
        "bookings",
        "documents",
        "rentals",
        "food_items",
        "expenses",
        "packing_items",
        "safety_contacts",
        "reminders",
      ];

      childStores.forEach((sName) => {
        const store = tx.objectStore(sName);
        if (store.indexNames.contains("by-tripId")) {
          const index = store.index("by-tripId");
          const cursorReq = index.openKeyCursor(IDBKeyRange.only(tripId));
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
              store.delete(cursor.primaryKey);
              cursor.continue();
            }
          };
        }
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(mapDOMException(tx.error));
      tx.onabort = () => reject(mapDOMException(tx.error));
    } catch (err) {
      reject(new VaultStorageError(`Cascade delete failed for trip '${tripId}'`, "TRANSACTION_FAILED", err));
    }
  });
}

// --- Store 2: Itineraries ---

export async function saveItineraryDay(day: ItineraryDayRecord): Promise<ItineraryDayRecord> {
  const updated: ItineraryDayRecord = {
    ...day,
    updatedAt: new Date().toISOString(),
  };
  return putRecord("itineraries", updated);
}

export async function getItinerariesForTrip(tripId: ID): Promise<ItineraryDayRecord[]> {
  const days = await getRecordsByIndex("itineraries", "by-tripId", tripId);
  return days.sort((a, b) => a.dayIndex - b.dayIndex);
}

export async function deleteItineraryDay(id: ID): Promise<boolean> {
  return deleteRecord("itineraries", id);
}

// --- Store 3: Bookings ---

export async function saveBooking(booking: BookingRecord): Promise<BookingRecord> {
  const updated: BookingRecord = {
    ...booking,
    updatedAt: new Date().toISOString(),
  };
  return putRecord("bookings", updated);
}

export async function getBooking(id: ID): Promise<BookingRecord | null> {
  return getRecord("bookings", id);
}

export async function getBookingsForTrip(tripId: ID): Promise<BookingRecord[]> {
  return getRecordsByIndex("bookings", "by-tripId", tripId);
}

export async function getBookingByPNR(pnr: string): Promise<BookingRecord | null> {
  const results = await getRecordsByIndex("bookings", "by-pnr", pnr.trim().toUpperCase());
  return results.length > 0 ? results[0] : null;
}

export async function deleteBooking(id: ID): Promise<boolean> {
  return deleteRecord("bookings", id);
}

// --- Store 4: Documents (Binary Attachments) ---

export async function saveDocument(
  doc: DocumentAttachmentRecord
): Promise<DocumentAttachmentRecord> {
  if (!doc.blobData) {
    throw new VaultStorageError(
      "Document blobData cannot be null or empty.",
      "CORRUPT_RECORD"
    );
  }

  const updated: DocumentAttachmentRecord = {
    ...doc,
    updatedAt: new Date().toISOString(),
  };
  return putRecord("documents", updated);
}

export async function getDocument(docId: ID): Promise<DocumentAttachmentRecord | null> {
  return getRecord("documents", docId);
}

export async function getDocumentsForTrip(tripId: ID): Promise<DocumentAttachmentRecord[]> {
  return getRecordsByIndex("documents", "by-tripId", tripId);
}

export async function getDocumentsForBooking(
  tripId: ID,
  bookingId: ID
): Promise<DocumentAttachmentRecord[]> {
  const allTripDocs = await getDocumentsForTrip(tripId);
  return allTripDocs.filter((d) => d.bookingId === bookingId);
}

export async function deleteDocument(docId: ID): Promise<boolean> {
  return deleteRecord("documents", docId);
}

// --- Store 5: Rentals ---

export async function saveRental(rental: VehicleRentalRecord): Promise<VehicleRentalRecord> {
  const updated: VehicleRentalRecord = {
    ...rental,
    updatedAt: new Date().toISOString(),
  };
  return putRecord("rentals", updated);
}

export async function getRentalsForTrip(tripId: ID): Promise<VehicleRentalRecord[]> {
  return getRecordsByIndex("rentals", "by-tripId", tripId);
}

export async function deleteRental(id: ID): Promise<boolean> {
  return deleteRecord("rentals", id);
}

// --- Store 6: Food Items ---

export async function saveFoodItem(item: FoodPlannerRecord): Promise<FoodPlannerRecord> {
  const updated: FoodPlannerRecord = {
    ...item,
    updatedAt: new Date().toISOString(),
  };
  return putRecord("food_items", updated);
}

export async function getFoodItemsForTrip(tripId: ID): Promise<FoodPlannerRecord[]> {
  return getRecordsByIndex("food_items", "by-tripId", tripId);
}

export async function deleteFoodItem(id: ID): Promise<boolean> {
  return deleteRecord("food_items", id);
}

// --- Store 7: Expenses & Deposits ---

export async function saveExpense(expense: ExpenseRecord): Promise<ExpenseRecord> {
  const updated: ExpenseRecord = {
    ...expense,
    updatedAt: new Date().toISOString(),
  };
  return putRecord("expenses", updated);
}

export async function getExpensesForTrip(tripId: ID): Promise<ExpenseRecord[]> {
  const records = await getRecordsByIndex("expenses", "by-tripId", tripId);
  return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getRefundableDepositsForTrip(tripId: ID): Promise<ExpenseRecord[]> {
  const records = await getExpensesForTrip(tripId);
  return records.filter((e) => e.isDeposit);
}

export async function deleteExpense(id: ID): Promise<boolean> {
  return deleteRecord("expenses", id);
}

// --- Store 8: Packing Items ---

export async function savePackingItem(item: PackingItemRecord): Promise<PackingItemRecord> {
  const updated: PackingItemRecord = {
    ...item,
    updatedAt: new Date().toISOString(),
  };
  return putRecord("packing_items", updated);
}

export async function getPackingItemsForTrip(tripId: ID): Promise<PackingItemRecord[]> {
  return getRecordsByIndex("packing_items", "by-tripId", tripId);
}

export async function togglePackingItem(id: ID, isPacked: boolean): Promise<PackingItemRecord> {
  const item = await getRecord("packing_items", id);
  if (!item) {
    throw new VaultStorageError(`Packing item with ID '${id}' not found.`, "NOT_FOUND");
  }
  item.isPacked = isPacked;
  return savePackingItem(item);
}

export async function deletePackingItem(id: ID): Promise<boolean> {
  return deleteRecord("packing_items", id);
}

// --- Store 9: Safety Contacts ---

export async function saveSafetyContact(
  contact: SafetyContactRecord
): Promise<SafetyContactRecord> {
  const updated: SafetyContactRecord = {
    ...contact,
    updatedAt: new Date().toISOString(),
  };
  return putRecord("safety_contacts", updated);
}

export async function getSafetyContactsForTrip(tripId: ID): Promise<SafetyContactRecord[]> {
  return getRecordsByIndex("safety_contacts", "by-tripId", tripId);
}

export async function deleteSafetyContact(id: ID): Promise<boolean> {
  return deleteRecord("safety_contacts", id);
}

// --- Store 10: Reminders ---

export async function saveReminder(reminder: ReminderRecord): Promise<ReminderRecord> {
  const updated: ReminderRecord = {
    ...reminder,
    updatedAt: new Date().toISOString(),
  };
  return putRecord("reminders", updated);
}

export async function getRemindersForTrip(tripId: ID): Promise<ReminderRecord[]> {
  const reminders = await getRecordsByIndex("reminders", "by-tripId", tripId);
  return reminders.sort((a, b) => new Date(a.triggerTime).getTime() - new Date(b.triggerTime).getTime());
}

export async function getPendingReminders(): Promise<ReminderRecord[]> {
  const allReminders = await getAllRecords("reminders");
  return allReminders.filter((r) => !r.isTriggered && !r.isCancelled);
}

export async function deleteReminder(id: ID): Promise<boolean> {
  return deleteRecord("reminders", id);
}

// --- Supporting Models: Waypoints & Route Segments ---

export async function getWaypointsForTrip(tripId: ID): Promise<WaypointRecord[]> {
  const trip = await getTrip(tripId);
  return trip?.waypoints || [];
}

export async function saveWaypoint(tripId: ID, waypoint: WaypointRecord): Promise<WaypointRecord> {
  const trip = await getTrip(tripId);
  if (!trip) throw new VaultStorageError(`Trip ${tripId} not found`, "NOT_FOUND");

  const waypoints = trip.waypoints ? [...trip.waypoints] : [];
  const existingIdx = waypoints.findIndex((w) => w.id === waypoint.id);
  if (existingIdx >= 0) {
    waypoints[existingIdx] = waypoint;
  } else {
    waypoints.push(waypoint);
  }

  await saveTrip({
    ...trip,
    waypoints,
    updatedAt: new Date().toISOString(),
  });

  return waypoint;
}

export async function deleteWaypoint(tripId: ID, waypointId: ID): Promise<boolean> {
  const trip = await getTrip(tripId);
  if (!trip) return false;

  const waypoints = (trip.waypoints || []).filter((w) => w.id !== waypointId);
  await saveTrip({
    ...trip,
    waypoints,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export async function getRouteSegmentsForTrip(tripId: ID): Promise<RouteSegment[]> {
  const trip = await getTrip(tripId);
  const segments = trip?.routeSegments || [];
  return segments.sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function saveRouteSegment(tripId: ID, segment: RouteSegment): Promise<RouteSegment> {
  const trip = await getTrip(tripId);
  if (!trip) throw new VaultStorageError(`Trip ${tripId} not found`, "NOT_FOUND");

  const segments = trip.routeSegments ? [...trip.routeSegments] : [];
  const existingIdx = segments.findIndex((s) => s.id === segment.id);
  if (existingIdx >= 0) {
    segments[existingIdx] = segment;
  } else {
    segments.push(segment);
  }

  await saveTrip({
    ...trip,
    routeSegments: segments,
    updatedAt: new Date().toISOString(),
  });

  return segment;
}

export async function deleteRouteSegment(tripId: ID, segmentId: ID): Promise<boolean> {
  const trip = await getTrip(tripId);
  if (!trip) return false;

  const segments = (trip.routeSegments || []).filter((s) => s.id !== segmentId);
  await saveTrip({
    ...trip,
    routeSegments: segments,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

// --- Supporting Models: Safety Medical Card & Contingency Plans ---

export async function getMedicalCardForTrip(tripId: ID): Promise<MedicalCardInfo | undefined> {
  const trip = await getTrip(tripId);
  return trip?.medicalCard;
}

export async function saveMedicalCard(tripId: ID, card: MedicalCardInfo): Promise<MedicalCardInfo> {
  const trip = await getTrip(tripId);
  if (!trip) throw new VaultStorageError(`Trip ${tripId} not found`, "NOT_FOUND");
  trip.medicalCard = card;
  trip.updatedAt = new Date().toISOString();
  await saveTrip(trip);
  return card;
}

export async function getContingenciesForTrip(tripId: ID): Promise<ContingencyPlan[]> {
  const trip = await getTrip(tripId);
  return trip?.contingencies || [];
}

export async function saveContingency(tripId: ID, plan: ContingencyPlan): Promise<ContingencyPlan> {
  const trip = await getTrip(tripId);
  if (!trip) throw new VaultStorageError(`Trip ${tripId} not found`, "NOT_FOUND");
  const plans = trip.contingencies ? [...trip.contingencies] : [];
  const idx = plans.findIndex((p) => p.id === plan.id);
  if (idx >= 0) {
    plans[idx] = plan;
  } else {
    plans.push(plan);
  }
  trip.contingencies = plans;
  trip.updatedAt = new Date().toISOString();
  await saveTrip(trip);
  return plan;
}

export async function deleteContingency(tripId: ID, planId: ID): Promise<boolean> {
  const trip = await getTrip(tripId);
  if (!trip || !trip.contingencies) return false;
  trip.contingencies = trip.contingencies.filter((p) => p.id !== planId);
  trip.updatedAt = new Date().toISOString();
  await saveTrip(trip);
  return true;
}

// --- Supporting Models: Trip Memories & Completed Trip Archive (REQ-MEM-01, REQ-MEM-02) ---

export async function getMemoriesForTrip(tripId: ID): Promise<TripMemoryRecord[]> {
  const trip = await getTrip(tripId);
  return trip?.memories || [];
}

export async function saveMemory(tripId: ID, memory: TripMemoryRecord): Promise<TripMemoryRecord> {
  const trip = await getTrip(tripId);
  if (!trip) throw new VaultStorageError(`Trip ${tripId} not found`, "NOT_FOUND");
  const memories = trip.memories ? [...trip.memories] : [];
  const idx = memories.findIndex((m) => m.id === memory.id);
  if (idx >= 0) {
    memories[idx] = memory;
  } else {
    memories.push(memory);
  }
  trip.memories = memories;
  trip.updatedAt = new Date().toISOString();
  await saveTrip(trip);
  return memory;
}

export async function deleteMemory(tripId: ID, memoryId: ID): Promise<boolean> {
  const trip = await getTrip(tripId);
  if (!trip || !trip.memories) return false;
  trip.memories = trip.memories.filter((m) => m.id !== memoryId);
  trip.updatedAt = new Date().toISOString();
  await saveTrip(trip);
  return true;
}

/**
 * REQ-MEM-01: Transitions trip status to COMPLETED and stamps completion timestamp
 */
export async function completeTripAndArchive(tripId: ID): Promise<TripRecord> {
  const trip = await getTrip(tripId);
  if (!trip) throw new VaultStorageError(`Trip ${tripId} not found`, "NOT_FOUND");
  trip.status = "COMPLETED";
  trip.completedAt = new Date().toISOString();
  trip.updatedAt = new Date().toISOString();
  await saveTrip(trip);
  return trip;
}

/**
 * Reopens a completed trip back to ACTIVE status
 */
export async function reopenTrip(tripId: ID): Promise<TripRecord> {
  const trip = await getTrip(tripId);
  if (!trip) throw new VaultStorageError(`Trip ${tripId} not found`, "NOT_FOUND");
  trip.status = "ACTIVE";
  trip.updatedAt = new Date().toISOString();
  await saveTrip(trip);
  return trip;
}


