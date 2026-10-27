/**
 * Life Atlas Finance: Budgets & Savings Goals Automated Test Suite (Phase 2)
 * 
 * Validates category budget calculations, limit thresholds, zero-division safety,
 * transfer exclusions from budgets, savings goals progress, and manual tracking integrity.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  deleteFinanceDB,
  IndexedDBUnitOfWork,
  AccountService,
  TransactionService,
  BudgetService,
  SavingsGoalService,
  FinanceError,
} from "@/lib/finance";

describe("Life Atlas Finance: Budgets & Savings Goals Engine", () => {
  let uow: IndexedDBUnitOfWork;
  let accountService: AccountService;
  let transactionService: TransactionService;
  let budgetService: BudgetService;
  let savingsGoalService: SavingsGoalService;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    accountService = new AccountService(uow);
    transactionService = new TransactionService(uow);
    budgetService = new BudgetService(uow);
    savingsGoalService = new SavingsGoalService(uow);
    await uow.categories.seedDefaults();
  });

  afterEach(async () => {
    await deleteFinanceDB();
  });

  describe("1. Category Budgets & Spending Progress (REQ-BGT-01)", () => {
    test("calculates category spending against allocated budget limit", async () => {
      const acc = await accountService.createAccount({
        name: "Household Checking",
        accountType: "bank",
        openingBalancePaise: 5000000, // ₹50,000
      });

      // Set Food & Dining budget to ₹10,000 (1000000 paise)
      await budgetService.setCategoryMonthlyBudget("cat_food_dining", 1000000);

      // Record a ₹4,000 grocery expense in October
      await transactionService.recordTransaction({
        accountId: acc.id,
        categoryId: "cat_food_dining",
        description: "Supermarket shopping",
        amountPaise: 400000,
        direction: "outflow",
        occurredAt: "2026-10-15T12:00:00.000Z",
      });

      const report = await budgetService.getCategoryBudgetStatuses(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T23:59:59.999Z"
      );

      const foodStatus = report.statuses.find((s) => s.categoryId === "cat_food_dining");
      assert.ok(foodStatus);
      assert.strictEqual(foodStatus.allocatedPaise, 1000000); // Limit ₹10,000
      assert.strictEqual(foodStatus.spentPaise, 400000); // Spent ₹4,000
      assert.strictEqual(foodStatus.remainingPaise, 600000); // Remaining ₹6,000
      assert.strictEqual(foodStatus.percentageUsed, 40); // 40%
      assert.strictEqual(foodStatus.isOverBudget, false);
      assert.strictEqual(foodStatus.isApproachingLimit, false);
    });

    test("flags approaching limit (>80%) and over-budget (>100%) correctly", async () => {
      const acc = await accountService.createAccount({
        name: "Main",
        accountType: "bank",
        openingBalancePaise: 10000000,
      });

      // Budget ₹5,000 for Entertainment
      await budgetService.setCategoryMonthlyBudget("cat_entertainment", 500000);

      // 1. Spend ₹4,500 (90% - approaching limit)
      await transactionService.recordTransaction({
        accountId: acc.id,
        categoryId: "cat_entertainment",
        description: "Concert tickets",
        amountPaise: 450000,
        direction: "outflow",
        occurredAt: "2026-10-05T00:00:00.000Z",
      });

      let report = await budgetService.getCategoryBudgetStatuses(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T23:59:59.999Z"
      );
      let entStatus = report.statuses.find((s) => s.categoryId === "cat_entertainment")!;
      assert.strictEqual(entStatus.percentageUsed, 90);
      assert.strictEqual(entStatus.isApproachingLimit, true);
      assert.strictEqual(entStatus.isOverBudget, false);

      // 2. Spend another ₹1,000 -> Total ₹5,500 (110% - over budget)
      await transactionService.recordTransaction({
        accountId: acc.id,
        categoryId: "cat_entertainment",
        description: "Movie IMAX",
        amountPaise: 100000,
        direction: "outflow",
        occurredAt: "2026-10-10T00:00:00.000Z",
      });

      report = await budgetService.getCategoryBudgetStatuses(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T23:59:59.999Z"
      );
      entStatus = report.statuses.find((s) => s.categoryId === "cat_entertainment")!;
      assert.strictEqual(entStatus.percentageUsed, 110);
      assert.strictEqual(entStatus.isOverBudget, true);
      assert.strictEqual(entStatus.remainingPaise, -50000); // Negative remaining
    });

    test("excludes internal transfers and reversed transactions from budget calculations", async () => {
      const source = await accountService.createAccount({
        name: "Checking",
        accountType: "bank",
        openingBalancePaise: 5000000,
      });

      const dest = await accountService.createAccount({
        name: "Savings",
        accountType: "savings",
        openingBalancePaise: 1000000,
      });

      await budgetService.setCategoryMonthlyBudget("cat_food_dining", 500000);

      // Transfer ₹2,000 between accounts (should NOT be counted as an expense or budget consumption)
      await transactionService.recordTransfer({
        sourceAccountId: source.id,
        destinationAccountId: dest.id,
        amountPaise: 200000,
        description: "Save funds",
        occurredAt: "2026-10-10T00:00:00.000Z",
      });

      // Record ₹1,000 food expense then reverse it
      const foodTxn = await transactionService.recordTransaction({
        accountId: source.id,
        categoryId: "cat_food_dining",
        description: "Food order cancelled",
        amountPaise: 100000,
        direction: "outflow",
        occurredAt: "2026-10-12T00:00:00.000Z",
      });
      await transactionService.reverseTransaction(foodTxn.id, "Order cancelled");

      const report = await budgetService.getCategoryBudgetStatuses(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T23:59:59.999Z"
      );
      const foodStatus = report.statuses.find((s) => s.categoryId === "cat_food_dining")!;
      assert.strictEqual(foodStatus.spentPaise, 0); // Transfers and reversed transactions ignored!
      assert.strictEqual(foodStatus.remainingPaise, 500000);
    });

    test("handles zero-budget categories without division by zero errors", async () => {
      const acc = await accountService.createAccount({
        name: "Main",
        accountType: "bank",
        openingBalancePaise: 1000000,
      });

      // Unbudgeted spend in Shopping (allocated = 0)
      await transactionService.recordTransaction({
        accountId: acc.id,
        categoryId: "cat_shopping",
        description: "Impulse buy",
        amountPaise: 150000,
        direction: "outflow",
        occurredAt: "2026-10-20T00:00:00.000Z",
      });

      const report = await budgetService.getCategoryBudgetStatuses(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T23:59:59.999Z"
      );

      const shopStatus = report.statuses.find((s) => s.categoryId === "cat_shopping");
      assert.ok(shopStatus);
      assert.strictEqual(shopStatus.allocatedPaise, 0);
      assert.strictEqual(shopStatus.spentPaise, 150000);
      assert.strictEqual(Number.isFinite(shopStatus.percentageUsed), true);
    });
  });

  describe("2. Savings Goals Engine (REQ-SAV-01)", () => {
    test("creates savings goals and tracks progress percentage accurately", async () => {
      const goal = await savingsGoalService.createGoal({
        name: "Himalayan Roadtrip",
        targetAmountPaise: 6000000, // ₹60,000 target
        currentAmountPaise: 1500000, // ₹15,000 initial saved
        targetDate: "2027-06-01T00:00:00.000Z",
        color: "#3B82F6",
      });

      assert.ok(goal.id.startsWith("goal_"));
      assert.strictEqual(goal.status, "in_progress");

      const views = await savingsGoalService.getGoalsWithProgress();
      const himalayas = views.find((g) => g.id === goal.id);
      assert.ok(himalayas);
      assert.strictEqual(himalayas.targetAmountPaise, 6000000);
      assert.strictEqual(himalayas.currentAmountPaise, 1500000);
      assert.strictEqual(himalayas.remainingAmountPaise, 4500000);
      assert.strictEqual(himalayas.percentComplete, 25); // 25%
      assert.strictEqual(himalayas.isCompleted, false);
      assert.ok((himalayas.daysRemaining || 0) > 100);
    });

    test("records manual progress contributions and transitions to reached status", async () => {
      const goal = await savingsGoalService.createGoal({
        name: "Emergency Fund Buffer",
        targetAmountPaise: 10000000, // ₹1,00,000
        currentAmountPaise: 8000000, // ₹80,000 (80%)
      });

      // Add ₹20,000 contribution
      const updated = await savingsGoalService.recordContribution(goal.id, 2000000);
      assert.strictEqual(updated.currentAmountPaise, 10000000);
      assert.strictEqual(updated.status, "reached");

      const views = await savingsGoalService.getGoalsWithProgress();
      const buffer = views.find((g) => g.id === goal.id)!;
      assert.strictEqual(buffer.percentComplete, 100);
      assert.strictEqual(buffer.remainingAmountPaise, 0);
      assert.strictEqual(buffer.isCompleted, true);
    });

    test("rejects invalid, zero, or negative target amounts", async () => {
      await assert.rejects(
        async () => {
          await savingsGoalService.createGoal({
            name: "Invalid Goal",
            targetAmountPaise: 0,
          });
        },
        (err: unknown) => err instanceof FinanceError && err.code === "INVALID_AMOUNT"
      );

      await assert.rejects(
        async () => {
          await savingsGoalService.createGoal({
            name: "Negative Goal",
            targetAmountPaise: -5000,
          });
        },
        (err: unknown) => err instanceof FinanceError && err.code === "INVALID_AMOUNT"
      );
    });
  });
});
