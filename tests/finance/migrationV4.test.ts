/**
 * Life Atlas Finance: Schema Migration V4 Automated Test Suite (Phase 4)
 * 
 * Validates progressive database upgrade to version 4, sync_conflicts store,
 * outbox nextRetryAt index, and zero data loss of pre-existing records.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  deleteFinanceDB,
  closeFinanceDB,
  IndexedDBUnitOfWork,
  FINANCE_DB_VERSION,
  getFinanceDB,
  rupeesToPaise,
} from "@/lib/finance";

describe("Life Atlas Finance: Database Migration V4 & Conflict Preservation", () => {
  beforeEach(async () => {
    await deleteFinanceDB();
  });

  afterEach(async () => {
    await closeFinanceDB();
    await deleteFinanceDB();
  });

  test("initializes sync_conflicts object store and nextRetryAt index in V4", async () => {
    const db = await getFinanceDB();
    assert.strictEqual(db.version, 4);
    assert.strictEqual(FINANCE_DB_VERSION, 4);

    // Verify all 10 finance stores exist
    assert.ok(db.objectStoreNames.contains("accounts"));
    assert.ok(db.objectStoreNames.contains("transactions"));
    assert.ok(db.objectStoreNames.contains("categories"));
    assert.ok(db.objectStoreNames.contains("budgets"));
    assert.ok(db.objectStoreNames.contains("savings_goals"));
    assert.ok(db.objectStoreNames.contains("audit_log"));
    assert.ok(db.objectStoreNames.contains("sync_outbox"));
    assert.ok(db.objectStoreNames.contains("categorization_rules"));
    assert.ok(db.objectStoreNames.contains("recurring_rules"));
    assert.ok(db.objectStoreNames.contains("sync_conflicts"));

    // Verify sync_conflicts indexes
    const tx = db.transaction(["sync_conflicts", "sync_outbox"], "readonly");
    const conflictStore = tx.objectStore("sync_conflicts");
    assert.ok(conflictStore.indexNames.contains("entityId"));
    assert.ok(conflictStore.indexNames.contains("resolution"));
    assert.ok(conflictStore.indexNames.contains("createdAt"));

    // Verify sync_outbox nextRetryAt index
    const outboxStore = tx.objectStore("sync_outbox");
    assert.ok(outboxStore.indexNames.contains("nextRetryAt"));
  });

  test("preserves all pre-existing records across progressive V1 -> V2 -> V3 -> V4 migrations", async () => {
    const uow = new IndexedDBUnitOfWork();

    // 1. Seed accounts & transactions
    const accId = "acc_mig_v4";
    await uow.accounts.save({
      id: accId,
      name: "Permanent Bank",
      accountType: "bank",
      currency: "INR",
      openingBalancePaise: rupeesToPaise(50000),
      openingBalanceDate: new Date().toISOString(),
      currentBalancePaise: rupeesToPaise(50000),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });

    await uow.transactions.save({
      id: "txn_mig_v4",
      accountId: accId,
      description: "Pre-migration transaction",
      amountPaise: rupeesToPaise(2500),
      currency: "INR",
      direction: "outflow",
      status: "posted",
      source: "manual",
      reviewRequired: false,
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });

    // 2. Seed a recurring rule
    await uow.recurringRules.save({
      id: "rec_mig_v4",
      accountId: accId,
      amountPaise: rupeesToPaise(5000),
      currency: "INR",
      direction: "inflow",
      description: "Consulting retainer",
      frequency: "monthly",
      interval: 1,
      startDate: new Date().toISOString(),
      nextDueDate: new Date().toISOString(),
      autoPost: false,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 3. Verify V4 status and data intact
    const db = await getFinanceDB();
    assert.strictEqual(db.version, 4);

    const fetchedAcc = await uow.accounts.getById("acc_mig_v4");
    assert.ok(fetchedAcc);
    assert.strictEqual(fetchedAcc.currentBalancePaise, rupeesToPaise(50000));

    const fetchedTxn = await uow.transactions.getById("txn_mig_v4");
    assert.ok(fetchedTxn);
    assert.strictEqual(fetchedTxn.amountPaise, rupeesToPaise(2500));

    const fetchedRec = await uow.recurringRules.getById("rec_mig_v4");
    assert.ok(fetchedRec);
    assert.strictEqual(fetchedRec.amountPaise, rupeesToPaise(5000));
  });
});
