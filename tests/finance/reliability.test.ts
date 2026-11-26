import "fake-indexeddb/auto";
import { beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  IndexedDBUnitOfWork,
  AccountService,
  TransactionService,
  SavingsGoalService,
  BalanceService,
  deleteFinanceDB,
} from "@/lib/finance";
import { stageLedgerMutation } from "@/lib/finance/application/ledgerMutation";
import { loadDashboardSnapshot } from "@/lib/finance/application/dashboardSnapshot";
import { FinanceRefreshQueue } from "@/lib/finance/application/refreshQueue";
let uow: IndexedDBUnitOfWork, service: TransactionService, bank: string;
beforeEach(async () => {
  await deleteFinanceDB();
  uow = new IndexedDBUnitOfWork();
  await uow.categories.seedDefaults();
  bank = (
    await new AccountService(uow).createAccount({
      name: "Synthetic test bank",
      accountType: "bank",
      openingBalancePaise: 100000,
    })
  ).id;
  service = new TransactionService(uow, async () => []);
});
afterEach(async () => {
  await deleteFinanceDB();
});
const expense = (extra = {}) =>
  service.recordTransaction({
    accountId: bank,
    amountPaise: 4000,
    description: "Synthetic test payment",
    direction: "outflow",
    categoryId: "cat_food_dining",
    ...extra,
  });
test("reverse then delete never refunds a savings allocation twice", async () => {
  const pocket = await new SavingsGoalService(uow).createPocket({
    name: "Food",
    linkedAccountId: bank,
    initialAllocationPaise: 30000,
  });
  const payment = await expense({ pocketId: pocket.id });
  assert.equal(
    (await uow.savingsGoals.getById(pocket.id))?.allocatedPaise,
    26000,
  );
  await service.reverseTransaction(payment.id, "Canceled test payment");
  assert.equal(
    (await uow.savingsGoals.getById(pocket.id))?.allocatedPaise,
    30000,
  );
  await service.deleteTransaction(payment.id);
  assert.equal(
    (await uow.savingsGoals.getById(pocket.id))?.allocatedPaise,
    30000,
  );
  assert.equal((await uow.accounts.getById(bank))?.currentBalancePaise, 100000);
});
test("amount correction adjusts the same pocket and reversing through edit restores its deduction", async () => {
  const pocket = await new SavingsGoalService(uow).createPocket({
    name: "Food",
    linkedAccountId: bank,
    initialAllocationPaise: 30000,
  });
  const payment = await expense({ pocketId: pocket.id });
  await service.correctTransaction(
    payment.id,
    { amountPaise: 6000 },
    "Amount correction",
  );
  assert.equal(
    (await uow.savingsGoals.getById(pocket.id))?.allocatedPaise,
    24000,
  );
  await service.correctTransaction(
    payment.id,
    { status: "reversed" },
    "Canceled",
  );
  assert.equal(
    (await uow.savingsGoals.getById(pocket.id))?.allocatedPaise,
    30000,
  );
  await service.deleteTransaction(payment.id);
  assert.equal(
    (await uow.savingsGoals.getById(pocket.id))?.allocatedPaise,
    30000,
  );
});
test("failed trip validation cannot consume a pocket or create an orphan ledger row", async () => {
  const pocket = await new SavingsGoalService(uow).createPocket({
    name: "Food",
    linkedAccountId: bank,
    initialAllocationPaise: 30000,
  });
  await assert.rejects(() =>
    expense({
      pocketId: pocket.id,
      tripAssignment: { mode: "manual", tripId: "missing" },
    }),
  );
  assert.equal(
    (await uow.savingsGoals.getById(pocket.id))?.allocatedPaise,
    30000,
  );
  assert.equal((await uow.transactions.query({})).length, 0);
});
test("deleting either transfer leg removes both legs and restores both cached balances", async () => {
  const cash = await new AccountService(uow).createAccount({
    name: "Cash",
    accountType: "cash",
    openingBalancePaise: 20000,
  });
  const transfer = await service.recordTransfer({
    sourceAccountId: bank,
    destinationAccountId: cash.id,
    amountPaise: 5000,
  });
  await assert.rejects(() =>
    service.correctTransaction(
      transfer.sourceTransaction.id,
      { amountPaise: 6000 },
      "Invalid one-sided change",
    ),
  );
  await service.deleteTransaction(transfer.destinationTransaction.id);
  assert.equal((await uow.transactions.query({})).length, 0);
  assert.equal((await uow.accounts.getById(bank))?.currentBalancePaise, 100000);
  assert.equal(
    (await uow.accounts.getById(cash.id))?.currentBalancePaise,
    20000,
  );
});
test("concurrent duplicate recording creates one payment, one balance movement and one outbox entry", async () => {
  const outcomes = await Promise.allSettled([expense(), expense()]);
  assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
  assert.equal((await uow.transactions.query({})).length, 1);
  assert.equal((await uow.accounts.getById(bank))?.currentBalancePaise, 96000);
  assert.equal(
    (await uow.outbox.getPending()).filter(
      (o) => o.entityType === "transaction",
    ).length,
    1,
  );
});
test("an audit failure rolls back journal, account balance and outbox as one commit", async () => {
  await assert.rejects(() =>
    stageLedgerMutation(uow, async (staged) => {
      await staged.transactions.save({
        id: "atomic-test",
        accountId: bank,
        description: "Rollback fixture",
        direction: "outflow",
        amountPaise: 100,
        currency: "INR",
        reviewRequired: false,
        status: "posted",
        source: "manual",
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      });
      const event = {
        id: "duplicate-audit",
        entityType: "transaction" as const,
        entityId: "atomic-test",
        action: "create" as const,
        changes: {},
        performedAt: new Date().toISOString(),
      };
      await staged.audit.record(event);
      await staged.audit.record(event);
    }),
  );
  assert.equal(await uow.transactions.getById("atomic-test"), null);
  assert.equal((await uow.accounts.getById(bank))?.currentBalancePaise, 100000);
  assert.equal(
    (await uow.outbox.getPending()).filter(
      (o) => o.entityType === "transaction",
    ).length,
    0,
  );
});
test("refunds reduce net expenses without inflating income, consistently across reports", async () => {
  await expense();
  await service.recordTransaction({
    accountId: bank,
    description: "Explicit test refund",
    direction: "inflow",
    amountPaise: 1000,
    paymentKind: "refund",
    categoryId: "cat_food_dining",
  });
  const from = "2000-01-01T00:00:00.000Z",
    to = "2100-01-01T00:00:00.000Z";
  const balances = new BalanceService(uow);
  const cash = await balances.getCashFlow(from, to);
  assert.equal(cash.totalIncomePaise, 0);
  assert.equal(cash.totalExpensesPaise, 3000);
  assert.equal(
    (await balances.getCategorySpendingBreakdown(from, to))[0].totalSpentPaise,
    3000,
  );
  assert.equal(
    (await balances.getCashFlowTimeline(from, to))[0].expensePaise,
    3000,
  );
});
test("available money excludes pending income, credit debt and pocket allocations", async () => {
  await new SavingsGoalService(uow).createPocket({
    name: "Reserved",
    linkedAccountId: bank,
    initialAllocationPaise: 30000,
  });
  await expense({ status: "pending" });
  await service.recordTransaction({
    accountId: bank,
    description: "Pending paycheck",
    direction: "inflow",
    amountPaise: 50000,
    status: "pending",
  });
  const snapshot = await loadDashboardSnapshot(uow);
  assert.equal(snapshot.spendablePaise, 66000);
  assert.equal(snapshot.pendingIncomingPaise, 50000);
});
test("refresh bursts coalesce and a later change requests exactly one latest follow-up", async () => {
  const queue = new FinanceRefreshQueue();
  let calls = 0;
  await Promise.all([
    queue.request(async () => {
      calls++;
    }),
    queue.request(async () => {
      calls++;
    }),
    queue.request(async () => {
      calls++;
    }),
  ]);
  assert.equal(calls, 1);
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    release = resolve;
  });
  const run = queue.request(async () => {
    calls++;
    await started;
  });
  await Promise.resolve();
  queue.request(async () => {
    calls += 100;
  });
  queue.request(async () => {
    calls++;
  });
  release();
  await run;
  assert.equal(calls, 3);
});

test("foreign currency accounts never inflate INR summary and cross-currency transfers are rejected", async () => {
  const dollars = await new AccountService(uow).createAccount({
    name: "USD account",
    accountType: "bank",
    currency: "USD",
    openingBalancePaise: 50000,
  });
  const snapshot = await loadDashboardSnapshot(uow);
  assert.equal(snapshot.accounts.length, 2);
  assert.equal(snapshot.spendablePaise, 100000);
  assert.equal(
    (await new BalanceService(snapshot.read).getNetWorth()).netWorthPaise,
    100000,
  );
  await assert.rejects(() =>
    service.recordTransfer({
      sourceAccountId: bank,
      destinationAccountId: dollars.id,
      amountPaise: 1000,
    }),
  );
  assert.equal((await uow.transactions.query({})).length, 0);
});
test("the dashboard snapshot scans the persisted ledger once across all reports", async () => {
  const rows = Array.from({ length: 10000 }, (_, i) => ({
    id: `performance-${i}`,
    accountId: bank,
    description: `Synthetic performance ${i}`,
    direction: "outflow" as const,
    amountPaise: 1,
    currency: "INR",
    reviewRequired: false,
    status: "posted" as const,
    source: "manual" as const,
    occurredAt: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString(),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
  }));
  await uow.transactions.saveBatch(rows);
  const original = IDBObjectStore.prototype.getAll;
  let ledgerReads = 0;
  IDBObjectStore.prototype.getAll = function (
    ...args: Parameters<typeof original>
  ) {
    if (this.name === "transactions") ledgerReads++;
    return original.apply(this, args);
  };
  try {
    const start = performance.now();
    const snapshot = await loadDashboardSnapshot(uow);
    const reports = new BalanceService(snapshot.read);
    await reports.getCashFlow(
      "2026-01-01T00:00:00.000Z",
      "2026-12-31T00:00:00.000Z",
    );
    await reports.getCashFlowTimeline(
      "2026-01-01T00:00:00.000Z",
      "2026-12-31T00:00:00.000Z",
    );
    await reports.getCategorySpendingBreakdown(
      "2026-01-01T00:00:00.000Z",
      "2026-12-31T00:00:00.000Z",
    );
    assert.equal(ledgerReads, 1);
    assert.equal(snapshot.transactions.length, 10000);
    console.log(
      `Finance synthetic desktop snapshot: 10000 records, ${ledgerReads} persisted ledger read, ${(performance.now() - start).toFixed(1)} ms (not phone performance)`,
    );
  } finally {
    IDBObjectStore.prototype.getAll = original;
  }
});

test("a stale editor cannot overwrite a newer correction", async () => {
  const original = await expense();
  await service.correctTransaction(
    original.id,
    { description: "Newer correction" },
    "First correction",
  );
  await assert.rejects(() =>
    service.correctTransaction(
      original.id,
      { expectedVersion: original.version, amountPaise: 9000 },
      "Stale editor",
    ),
  );
  assert.equal(
    (await uow.transactions.getById(original.id))?.amountPaise,
    4000,
  );
});

test("net worth and forecasts derive balances from the journal instead of a stale cache", async () => {
  await expense();
  await uow.accounts.updateBalance(bank, 999);
  assert.equal(
    (await new BalanceService(uow).getNetWorth()).netWorthPaise,
    96000,
  );
  const snapshot = await loadDashboardSnapshot(uow);
  assert.equal(snapshot.accounts[0].currentBalancePaise, 96000);
  assert.equal(
    (await uow.accounts.getById(bank))?.currentBalancePaise,
    999,
    "Reporting must not silently rewrite a saved record",
  );
});

test("dashboard counts unsynced work by index without loading completed outbox payloads", async () => {
  await expense();
  const operation = (await uow.outbox.getPending()).find(
    (o) => o.entityType === "transaction",
  )!;
  await uow.outbox.markFailedRetryable(
    operation.id,
    "Synthetic network failure",
    "2100-01-01T00:00:00.000Z",
  );
  const original = IDBObjectStore.prototype.getAll;
  IDBObjectStore.prototype.getAll = function (
    ...args: Parameters<typeof original>
  ) {
    assert.notEqual(
      this.name,
      "sync_outbox",
      "Dashboard should not load sync payloads",
    );
    return original.apply(this, args);
  };
  try {
    assert.equal((await loadDashboardSnapshot(uow)).pendingOutboxCount, 2);
  } finally {
    IDBObjectStore.prototype.getAll = original;
  }
});
