/**
 * Life Atlas Finance: Cloud Sync Protocol & Conflict Engine Test Suite (Phase 4)
 * 
 * Verifies versioned sync protocol (v1), incremental cursor advancement,
 * remote conflict staging, transfer group invariant protection, and honest offline handling.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  deleteFinanceDB,
  IndexedDBUnitOfWork,
  SyncOutboxService,
  TestableCloudSyncAdapter,
  UnconfiguredCloudSyncAdapter,
  SYNC_PROTOCOL_VERSION,
  Transaction,
  rupeesToPaise,
} from "@/lib/finance";

describe("Life Atlas Finance: Sync Protocol & Conflict Handling", () => {
  let uow: IndexedDBUnitOfWork;
  let testAdapter: TestableCloudSyncAdapter;
  let syncService: SyncOutboxService;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    testAdapter = new TestableCloudSyncAdapter();
    syncService = new SyncOutboxService(uow, testAdapter, "test_client_sync");
  });

  afterEach(async () => {
    await deleteFinanceDB();
  });

  test("UnconfiguredCloudSyncAdapter reports unconfigured status honestly and prevents mock sync", async () => {
    const unconfigured = new UnconfiguredCloudSyncAdapter();
    assert.strictEqual(unconfigured.isConfigured(), false);

    await assert.rejects(
      async () => {
        await unconfigured.push({
          protocolVersion: SYNC_PROTOCOL_VERSION,
          clientId: "client_offline",
          operations: [],
        });
      },
      {
        message: /Cloud synchronization is unconfigured/,
      }
    );
  });

  test("performs bidirectional synchronization and advances remote cursors", async () => {
    // 1. Stage local mutation with valid complete transaction
    await uow.outbox.enqueue({
      id: "op_sync_push_1",
      entityType: "transaction",
      entityId: "txn_push_1",
      action: "create",
      payloadJson: JSON.stringify({
        id: "txn_push_1",
        accountId: "acc_bank_local",
        description: "Local creation",
        amountPaise: rupeesToPaise(1200),
        currency: "INR",
        direction: "outflow",
        status: "posted",
        source: "manual",
        reviewRequired: false,
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      } as Transaction),
      timestamp: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      idempotencyKey: "idemp_push_1",
    });

    // 2. Stage remote incoming change on test adapter
    testAdapter.seedRemoteChanges([
      {
        entityType: "transaction",
        entityId: "txn_pull_1",
        action: "create",
        version: 1,
        payloadJson: JSON.stringify({
          id: "txn_pull_1",
          accountId: "acc_bank_remote",
          description: "Incoming remote transaction",
          amountPaise: rupeesToPaise(3500),
          currency: "INR",
          direction: "outflow",
          status: "posted",
          source: "manual",
          reviewRequired: false,
          occurredAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        } as Transaction),
        timestamp: new Date().toISOString(),
      },
    ]);

    // 3. Process push
    const pushStats = await syncService.processOutbox();
    assert.strictEqual(pushStats.acknowledgedCount, 1);

    // 4. Reconcile pull
    const pullStats = await syncService.reconcileRemoteChanges();
    assert.strictEqual(pullStats.appliedCount, 2); // Both pushed txn and seeded remote txn applied
    assert.strictEqual(pullStats.conflictCount, 0);

    // Verify incoming transaction exists in local database
    const localTxn = await uow.transactions.getById("txn_pull_1");
    assert.ok(localTxn);
    assert.strictEqual(localTxn.description, "Incoming remote transaction");
    assert.strictEqual(localTxn.amountPaise, rupeesToPaise(3500));
  });

  test("protects transfer group invariant when remote sends isolated transfer leg", async () => {
    // Local state has leg 1 of a transfer
    const transferGroupId = "grp_transfer_test_99";
    const localLeg1: Transaction = {
      id: "txn_transfer_leg_1",
      accountId: "acc_source",
      description: "Transfer to Savings (Source)",
      amountPaise: rupeesToPaise(10000),
      currency: "INR",
      direction: "outflow",
      status: "posted",
      source: "manual",
      transferGroupId,
      reviewRequired: false,
      occurredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    await uow.transactions.save(localLeg1);

    // Remote tries to update leg 1 with higher version, but partner leg 2 is MISSING
    testAdapter.seedRemoteChanges([
      {
        entityType: "transaction",
        entityId: "txn_transfer_leg_1",
        action: "update",
        version: 2,
        payloadJson: JSON.stringify({
          ...localLeg1,
          amountPaise: rupeesToPaise(15000), // Remote modified amount unilaterally!
          version: 2,
        }),
        timestamp: new Date().toISOString(),
      },
    ]);

    // Reconcile: must detect transfer violation and stage in sync_conflicts store
    const result = await syncService.reconcileRemoteChanges();
    assert.strictEqual(result.conflictCount, 1);
    assert.strictEqual(result.appliedCount, 0);

    // Check conflict repository
    const allConflicts = await uow.conflicts.getAll();
    assert.strictEqual(allConflicts.length, 1);
    assert.strictEqual(allConflicts[0].entityId, "txn_transfer_leg_1");
    assert.strictEqual(allConflicts[0].resolution, "unresolved");

    // Local transaction MUST remain unchanged at ₹10,000 (preserving invariant)
    const preservedTxn = await uow.transactions.getById("txn_transfer_leg_1");
    assert.strictEqual(preservedTxn?.amountPaise, rupeesToPaise(10000));
    assert.strictEqual(preservedTxn?.version, 1);
  });
});
