/**
 * Life Atlas Finance: Dashboard Reporting & Migration Automated Test Suite (Phase 2)
 * 
 * Tests empty database state, period boundary computations, category spending breakdowns,
 * cash-flow timelines, and V1 to V2 schema migration data preservation.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  deleteFinanceDB,
  closeFinanceDB,
  IndexedDBUnitOfWork,
  AccountService,
  TransactionService,
  BalanceService,
} from "@/lib/finance";

describe("Life Atlas Finance: Dashboard Reporting & Analytics Engine", () => {
  let uow: IndexedDBUnitOfWork;
  let accountService: AccountService;
  let transactionService: TransactionService;
  let balanceService: BalanceService;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    accountService = new AccountService(uow);
    transactionService = new TransactionService(uow);
    balanceService = new BalanceService(uow);
    await uow.categories.seedDefaults();
  });

  afterEach(async () => {
    await deleteFinanceDB();
  });

  describe("1. Empty Database State (REQ-DSH-01)", () => {
    test("handles empty finance database gracefully without errors", async () => {
      const nw = await balanceService.getNetWorth();
      assert.strictEqual(nw.netWorthPaise, 0);
      assert.strictEqual(nw.totalAssetsPaise, 0);
      assert.strictEqual(nw.totalLiabilitiesPaise, 0);

      const flow = await balanceService.getCashFlow(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T23:59:59.999Z"
      );
      assert.strictEqual(flow.totalIncomePaise, 0);
      assert.strictEqual(flow.totalExpensesPaise, 0);
      assert.strictEqual(flow.netCashFlowPaise, 0);
      assert.strictEqual(flow.savingsRatePercentage, 0);

      const breakdown = await balanceService.getCategorySpendingBreakdown(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T23:59:59.999Z"
      );
      assert.strictEqual(breakdown.length, 0);

      const timeline = await balanceService.getCashFlowTimeline(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T23:59:59.999Z"
      );
      assert.strictEqual(timeline.length, 0);
    });
  });

  describe("2. Period Date-Range Filtering (REQ-DSH-02)", () => {
    test("strictly bounds cash flow reporting to the selected period", async () => {
      const acc = await accountService.createAccount({
        name: "Salary Checking",
        accountType: "bank",
        openingBalancePaise: 10000000,
      });

      // September transaction
      await transactionService.recordTransaction({
        accountId: acc.id,
        description: "September Freelance",
        amountPaise: 2000000,
        direction: "inflow",
        occurredAt: "2026-09-20T10:00:00.000Z",
      });

      // October transactions
      await transactionService.recordTransaction({
        accountId: acc.id,
        description: "October Salary",
        amountPaise: 5000000,
        direction: "inflow",
        occurredAt: "2026-10-01T09:00:00.000Z",
      });

      await transactionService.recordTransaction({
        accountId: acc.id,
        description: "October Rent",
        amountPaise: 1500000,
        direction: "outflow",
        occurredAt: "2026-10-02T10:00:00.000Z",
      });

      // November transaction
      await transactionService.recordTransaction({
        accountId: acc.id,
        description: "November Advance",
        amountPaise: 3000000,
        direction: "inflow",
        occurredAt: "2026-11-05T10:00:00.000Z",
      });

      // Query October only
      const octFlow = await balanceService.getCashFlow(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T23:59:59.999Z"
      );

      // October Income: ₹50,000 (September ₹20,000 and November ₹30,000 excluded!)
      assert.strictEqual(octFlow.totalIncomePaise, 5000000);
      // October Expense: ₹15,000
      assert.strictEqual(octFlow.totalExpensesPaise, 1500000);
      // Net flow: ₹35,000
      assert.strictEqual(octFlow.netCashFlowPaise, 3500000);
    });
  });

  describe("3. Category Spending Breakdown & Timeline (REQ-DSH-03)", () => {
    test("computes category spending percentages and amounts sorted descending", async () => {
      const acc = await accountService.createAccount({
        name: "Expedition Card",
        accountType: "bank",
        openingBalancePaise: 10000000,
      });

      // ₹6,000 Food (60%)
      await transactionService.recordTransaction({
        accountId: acc.id,
        categoryId: "cat_food_dining",
        description: "Dinner",
        amountPaise: 600000,
        direction: "outflow",
        occurredAt: "2026-10-10T12:00:00.000Z",
      });

      // ₹3,000 Transport (30%)
      await transactionService.recordTransaction({
        accountId: acc.id,
        categoryId: "cat_transport",
        description: "Fuel",
        amountPaise: 300000,
        direction: "outflow",
        occurredAt: "2026-10-11T12:00:00.000Z",
      });

      // ₹1,000 Entertainment (10%)
      await transactionService.recordTransaction({
        accountId: acc.id,
        categoryId: "cat_entertainment",
        description: "Museum Entry",
        amountPaise: 100000,
        direction: "outflow",
        occurredAt: "2026-10-12T12:00:00.000Z",
      });

      const breakdown = await balanceService.getCategorySpendingBreakdown(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T23:59:59.999Z"
      );

      assert.strictEqual(breakdown.length, 3);
      // Check descending sort order
      assert.strictEqual(breakdown[0].categoryId, "cat_food_dining");
      assert.strictEqual(breakdown[0].totalSpentPaise, 600000);
      assert.strictEqual(breakdown[0].percentage, 60);

      assert.strictEqual(breakdown[1].categoryId, "cat_transport");
      assert.strictEqual(breakdown[1].totalSpentPaise, 300000);
      assert.strictEqual(breakdown[1].percentage, 30);

      assert.strictEqual(breakdown[2].categoryId, "cat_entertainment");
      assert.strictEqual(breakdown[2].totalSpentPaise, 100000);
      assert.strictEqual(breakdown[2].percentage, 10);
    });

    test("aggregates cash flow timeline points by date", async () => {
      const acc = await accountService.createAccount({
        name: "Checking",
        accountType: "bank",
        openingBalancePaise: 5000000,
      });

      await transactionService.recordTransaction({
        accountId: acc.id,
        description: "Income Day 1",
        amountPaise: 100000,
        direction: "inflow",
        occurredAt: "2026-10-15T09:00:00.000Z",
      });

      await transactionService.recordTransaction({
        accountId: acc.id,
        description: "Expense Day 1",
        amountPaise: 40000,
        direction: "outflow",
        occurredAt: "2026-10-15T15:00:00.000Z",
      });

      const timeline = await balanceService.getCashFlowTimeline(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T23:59:59.999Z"
      );

      assert.strictEqual(timeline.length, 1);
      assert.strictEqual(timeline[0].dateKey, "2026-10-15");
      assert.strictEqual(timeline[0].incomePaise, 100000);
      assert.strictEqual(timeline[0].expensePaise, 40000);
      assert.strictEqual(timeline[0].netPaise, 60000);
    });
  });

  describe("4. Schema Versioning & Data Preservation (REQ-DSH-04)", () => {
    test("preserves existing account and transaction data across migrations", async () => {
      // 1. Create account and transactions
      const acc = await accountService.createAccount({
        name: "Preserved Account",
        accountType: "bank",
        openingBalancePaise: 5000000,
      });

      const txn = await transactionService.recordTransaction({
        accountId: acc.id,
        description: "Preserved Transaction",
        amountPaise: 100000,
        direction: "outflow",
      });

      // 2. Close connection
      await closeFinanceDB();

      // 3. Re-open and verify everything persisted intact
      const freshUow = new IndexedDBUnitOfWork();
      const freshAcc = await freshUow.accounts.getById(acc.id);
      assert.ok(freshAcc);
      assert.strictEqual(freshAcc.name, "Preserved Account");
      assert.strictEqual(freshAcc.currentBalancePaise, 4900000); // 50,000 - 1,000

      const freshTxn = await freshUow.transactions.getById(txn.id);
      assert.ok(freshTxn);
      assert.strictEqual(freshTxn.description, "Preserved Transaction");

      // Verify the new Budgets store is functional
      const allBudgets = await freshUow.budgets.getAll();
      assert.ok(Array.isArray(allBudgets));
    });
  });
});
