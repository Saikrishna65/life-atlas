/**
 * Life Atlas Finance: Sync Outbox & Lease Processor Test Suite (Phase 4)
 * 
 * Tests outbox queuing, idempotency, lease claiming, exponential backoff,
 * stale claim reclamation, permanent failure classification, and retry management.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  deleteFinanceDB,
  IndexedDBUnitOfWork,
  SyncOutboxService,
  TestableCloudSyncAdapter,
  SyncOperation,
} from "@/lib/finance";

describe("Life Atlas Finance: Sync Outbox Lifecycle & Processing", () => {
  let uow: IndexedDBUnitOfWork;
  let testAdapter: TestableCloudSyncAdapter;
  let outboxService: SyncOutboxService;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    testAdapter = new TestableCloudSyncAdapter();
    outboxService = new SyncOutboxService(uow, testAdapter, "test_client_1");
  });

  afterEach(async () => {
    await deleteFinanceDB();
  });

  test("enqueues operations with stable idempotency keys and claims pending with lease token", async () => {
    const op: SyncOperation = {
      id: "op_101",
      entityType: "transaction",
      entityId: "txn_555",
      action: "create",
      payloadJson: JSON.stringify({ description: "Test purchase", amountPaise: 5000 }),
      timestamp: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      idempotencyKey: "idemp_txn_555_v1",
    };

    await uow.outbox.enqueue(op);

    // Verify in outbox
    const allPending = await uow.outbox.getPending();
    assert.strictEqual(allPending.length, 1);
    assert.strictEqual(allPending[0].id, "op_101");

    // Claim pending with lease token
    const claimToken = "claim_session_abc";
    const claimed = await uow.outbox.claimPending(claimToken, 10);
    assert.strictEqual(claimed.length, 1);
    assert.strictEqual(claimed[0].status, "in_progress");
    assert.strictEqual(claimed[0].claimToken, claimToken);
    assert.ok(claimed[0].claimedAt);

    // Another worker trying to claim immediately should get 0 operations
    const secondClaim = await uow.outbox.claimPending("claim_session_xyz", 10);
    assert.strictEqual(secondClaim.length, 0);
  });

  test("successfully processes outbox batch and transitions acknowledged items to synced", async () => {
    // Enqueue 2 operations
    await uow.outbox.enqueue({
      id: "op_ack_1",
      entityType: "account",
      entityId: "acc_1",
      action: "create",
      payloadJson: "{}",
      timestamp: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      idempotencyKey: "idemp_acc_1_v1",
    });

    await uow.outbox.enqueue({
      id: "op_ack_2",
      entityType: "transaction",
      entityId: "txn_2",
      action: "create",
      payloadJson: "{}",
      timestamp: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      idempotencyKey: "idemp_txn_2_v1",
    });

    // Process through service using TestableCloudSyncAdapter
    const stats = await outboxService.processOutbox(10);

    assert.strictEqual(stats.claimedCount, 2);
    assert.strictEqual(stats.acknowledgedCount, 2);
    assert.strictEqual(stats.retryableFailedCount, 0);

    // Verify stored state
    const op1 = await uow.outbox.getById("op_ack_1");
    assert.strictEqual(op1?.status, "synced");

    const op2 = await uow.outbox.getById("op_ack_2");
    assert.strictEqual(op2?.status, "synced");
  });

  test("handles retryable failure with exponential backoff and nextRetryAt calculation", async () => {
    await uow.outbox.enqueue({
      id: "op_retry_1",
      entityType: "transaction",
      entityId: "txn_fail_1",
      action: "create",
      payloadJson: "{}",
      timestamp: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      idempotencyKey: "idemp_fail_1",
    });

    // Configure test adapter to reject retryably
    testAdapter.configureRejections(["op_retry_1"], false, "Rate limited by upstream");

    const stats = await outboxService.processOutbox(10);
    assert.strictEqual(stats.retryableFailedCount, 1);
    assert.strictEqual(stats.permanentFailedCount, 0);

    const failedOp = await uow.outbox.getById("op_retry_1");
    assert.strictEqual(failedOp?.status, "failed_retryable");
    assert.ok(failedOp?.lastError?.includes("Rate limited"));
    assert.ok(failedOp?.nextRetryAt);
    assert.ok(new Date(failedOp.nextRetryAt).getTime() > Date.now());
  });

  test("classifies permanent failure and does not re-attempt indefinitely", async () => {
    await uow.outbox.enqueue({
      id: "op_perm_1",
      entityType: "transaction",
      entityId: "txn_perm_1",
      action: "create",
      payloadJson: "{}",
      timestamp: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      idempotencyKey: "idemp_perm_1",
    });

    // Configure test adapter to reject permanently (e.g. schema invalid)
    testAdapter.configureRejections(["op_perm_1"], true, "Malformed entity payload");

    const stats = await outboxService.processOutbox(10);
    assert.strictEqual(stats.permanentFailedCount, 1);
    assert.strictEqual(stats.retryableFailedCount, 0);

    const op = await uow.outbox.getById("op_perm_1");
    assert.strictEqual(op?.status, "failed_permanent");

    // Next process run should NOT claim permanent failure
    const nextStats = await outboxService.processOutbox(10);
    assert.strictEqual(nextStats.claimedCount, 0);
  });

  test("reclaims stale in-progress claims after lease timeout", async () => {
    const pastTime = new Date(Date.now() - 90000).toISOString(); // 90 seconds ago

    await uow.outbox.enqueue({
      id: "op_stale_1",
      entityType: "budget",
      entityId: "bgt_stale_1",
      action: "update",
      payloadJson: "{}",
      timestamp: pastTime,
      status: "in_progress",
      retryCount: 1,
      claimToken: "abandoned_lease",
      claimedAt: pastTime,
      idempotencyKey: "idemp_stale_1",
    });

    // Release stale claims older than 60,000ms
    const recovered = await uow.outbox.releaseStaleClaims(60000);
    assert.strictEqual(recovered, 1);

    const recoveredOp = await uow.outbox.getById("op_stale_1");
    assert.strictEqual(recoveredOp?.status, "pending");
    assert.strictEqual(recoveredOp?.claimToken, undefined);
    assert.strictEqual(recoveredOp?.claimedAt, undefined);
  });

  test("manually resets failed operations back to pending", async () => {
    await uow.outbox.enqueue({
      id: "op_failed_retryable",
      entityType: "goal",
      entityId: "gol_1",
      action: "create",
      payloadJson: "{}",
      timestamp: new Date().toISOString(),
      status: "failed_retryable",
      retryCount: 2,
      idempotencyKey: "idemp_gol_1",
    });

    await uow.outbox.enqueue({
      id: "op_failed_perm",
      entityType: "goal",
      entityId: "gol_2",
      action: "create",
      payloadJson: "{}",
      timestamp: new Date().toISOString(),
      status: "failed_permanent",
      retryCount: 5,
      idempotencyKey: "idemp_gol_2",
    });

    const resetCount = await outboxService.retryFailedOperations();
    assert.strictEqual(resetCount, 2);

    const op1 = await uow.outbox.getById("op_failed_retryable");
    assert.strictEqual(op1?.status, "pending");

    const op2 = await uow.outbox.getById("op_failed_perm");
    assert.strictEqual(op2?.status, "pending");
  });
});

