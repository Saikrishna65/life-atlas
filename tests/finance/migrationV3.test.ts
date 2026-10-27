/**
 * Life Atlas Finance: Schema Migration V3 Automated Test Suite (Phase 3)
 * 
 * Validates database migration to version 3, object store initialization,
 * system rule seeding, and zero data loss of pre-existing records.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  deleteFinanceDB,
  IndexedDBUnitOfWork,
  FINANCE_DB_NAME,
  FINANCE_DB_VERSION,
  getFinanceDB,
  migrateToV1,
  migrateToV2,
  migrateToV3,
} from "@/lib/finance";

describe("Life Atlas Finance: Database Migration V3 & Data Preservation", () => {
  beforeEach(async () => {
    await deleteFinanceDB();
  });

  afterEach(async () => {
    await deleteFinanceDB();
  });

  test("initializes categorization_rules and recurring_rules object stores", async () => {
    const db = await getFinanceDB();
    assert.strictEqual(db.version, FINANCE_DB_VERSION);
    assert.ok(db.objectStoreNames.contains("categorization_rules"));
    assert.ok(db.objectStoreNames.contains("recurring_rules"));
    assert.ok(db.objectStoreNames.contains("budgets"));
    assert.ok(db.objectStoreNames.contains("accounts"));
    assert.ok(db.objectStoreNames.contains("transactions"));
  });

  test("seeds default categorization rules during V3 upgrade", async () => {
    const uow = new IndexedDBUnitOfWork();
    const rules = await uow.categorizationRules.getAll();
    assert.ok(rules.length >= 15);

    // Verify key Indian rules exist
    const swiggy = rules.find((r) => r.pattern === "swiggy");
    assert.ok(swiggy);
    assert.strictEqual(swiggy.categoryId, "cat_food_dining");

    const zepto = rules.find((r) => r.pattern === "zepto");
    assert.ok(zepto);
    assert.strictEqual(zepto.categoryId, "cat_groceries");

    const salary = rules.find((r) => r.pattern === "salary");
    assert.ok(salary);
    assert.strictEqual(salary.categoryId, "cat_salary");
  });

  test("preserves all existing records across progressive V1 -> V2 -> V3 upgrades", async () => {
    // 1. Manually open DB at version 1 and seed an account
    const dbV1 = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(FINANCE_DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        const tx = (e.target as IDBOpenDBRequest).transaction!;
        migrateToV1(db, tx);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    await new Promise<void>((resolve, reject) => {
      const tx = dbV1.transaction("accounts", "readwrite");
      tx.objectStore("accounts").put({
        id: "acc_mig_v1",
        name: "Legacy Account",
        accountType: "bank",
        currency: "INR",
        openingBalancePaise: 500000,
        openingBalanceDate: "2026-01-01T00:00:00.000Z",
        currentBalancePaise: 500000,
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: 1,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    dbV1.close();

    // 2. Open DB at version 3 (triggering V2 and V3 migrations)
    const dbV3 = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(FINANCE_DB_NAME, 3);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        const tx = (e.target as IDBOpenDBRequest).transaction!;
        if (e.oldVersion < 2) migrateToV2(db, tx);
        if (e.oldVersion < 3) migrateToV3(db, tx);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // 3. Verify legacy account was preserved intact
    const preservedAccount = await new Promise<any>((resolve, reject) => {
      const tx = dbV3.transaction("accounts", "readonly");
      const req = tx.objectStore("accounts").get("acc_mig_v1");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    assert.ok(preservedAccount);
    assert.strictEqual(preservedAccount.name, "Legacy Account");
    assert.strictEqual(preservedAccount.currentBalancePaise, 500000);

    // 4. Verify new V3 stores are functional
    assert.ok(dbV3.objectStoreNames.contains("categorization_rules"));
    assert.ok(dbV3.objectStoreNames.contains("recurring_rules"));
    dbV3.close();
  });
});

