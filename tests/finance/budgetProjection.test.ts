/**
 * Life Atlas Finance: Budget Projections & Month-End Forecasting Test Suite (Phase 4)
 * 
 * Verifies end-of-period category spending projections, elapsed time calculations,
 * and over-budget risk level classifications.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  deleteFinanceDB,
  closeFinanceDB,
  IndexedDBUnitOfWork,
  BudgetProjectionService,
  AccountService,
  TransactionService,
  BudgetService,
  rupeesToPaise,
} from "@/lib/finance";

describe("Life Atlas Finance: Budget-Aware End-of-Month Projections", () => {
  let uow: IndexedDBUnitOfWork;
  let projectionService: BudgetProjectionService;
  let accountService: AccountService;
  let transactionService: TransactionService;
  let budgetService: BudgetService;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    projectionService = new BudgetProjectionService(uow);
    accountService = new AccountService(uow);
    transactionService = new TransactionService(uow);
    budgetService = new BudgetService(uow);

    // Ensure default categories exist
    await uow.categories.seedDefaults();
  });

  afterEach(async () => {
    await closeFinanceDB();
    await deleteFinanceDB();
  });

  test("projects category spending to end-of-month and assigns risk levels accurately", async () => {
    const bank = await accountService.createAccount({
      name: "Primary Bank",
      accountType: "bank",
      currency: "INR",
      openingBalancePaise: rupeesToPaise(100000),
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    // 1. Create a monthly budget with ₹10,000 for Food & Dining and ₹15,000 for Groceries
    await budgetService.saveBudget({
      name: "Current Month Budget",
      period: "monthly",
      startDate: startOfMonth,
      endDate: endOfMonth,
      categoryAllocations: {
        cat_food_dining: rupeesToPaise(10000), // ₹10,000 limit
        cat_groceries: rupeesToPaise(15000), // ₹15,000 limit
      },
    });

    // 2. Record transactions in current month
    // Food & Dining: spent ₹8,000 already
    await transactionService.recordTransaction({
      accountId: bank.id,
      amountPaise: rupeesToPaise(8000),
      direction: "outflow",
      categoryId: "cat_food_dining",
      description: "Fine dining restaurant",
      occurredAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: "posted",
      source: "manual",
    });

    // Groceries: spent ₹2,000
    await transactionService.recordTransaction({
      accountId: bank.id,
      amountPaise: rupeesToPaise(2000),
      direction: "outflow",
      categoryId: "cat_groceries",
      description: "Supermarket run",
      occurredAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      status: "posted",
      source: "manual",
    });

    const projections = await projectionService.projectEndOfMonthBudgets(startOfMonth, endOfMonth);

    assert.ok(projections.length >= 2);

    const foodProj = projections.find((p) => p.categoryId === "cat_food_dining");
    assert.ok(foodProj);
    assert.strictEqual(foodProj.spentSoFarPaise, rupeesToPaise(8000));
    assert.strictEqual(foodProj.allocatedPaise, rupeesToPaise(10000));
    assert.ok(foodProj.projectedEndOfMonthPaise >= rupeesToPaise(8000));

    const grocProj = projections.find((p) => p.categoryId === "cat_groceries");
    assert.ok(grocProj);
    assert.strictEqual(grocProj.spentSoFarPaise, rupeesToPaise(2000));
    assert.strictEqual(grocProj.allocatedPaise, rupeesToPaise(15000));
    assert.strictEqual(grocProj.riskLevel, "normal");
  });
});
