/**
 * Life Atlas Finance: Financial Runway & Affordability Test Suite (Phase 4)
 * 
 * Tests spendable liquid assets rules, burn rate computations,
 * surplus cash flow handling, stress test scenarios, and low-balance alerts.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  deleteFinanceDB,
  IndexedDBUnitOfWork,
  RunwayService,
  AccountService,
  TransactionService,
  BalanceService,
  rupeesToPaise,
} from "@/lib/finance";

describe("Life Atlas Finance: Runway & Affordability Service", () => {
  let uow: IndexedDBUnitOfWork;
  let runwayService: RunwayService;
  let accountService: AccountService;
  let transactionService: TransactionService;
  let balanceService: BalanceService;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    runwayService = new RunwayService(uow);
    accountService = new AccountService(uow);
    transactionService = new TransactionService(uow);
    balanceService = new BalanceService(uow);
  });

  afterEach(async () => {
    await deleteFinanceDB();
  });

  test("liquid assets include bank and cash only, strictly excluding credit cards", async () => {
    // Bank account with ₹1,00,000
    await accountService.createAccount({
      name: "SBI Savings",
      accountType: "bank",
      currency: "INR",
      openingBalancePaise: rupeesToPaise(100000),
    });

    // Cash wallet with ₹15,000
    await accountService.createAccount({
      name: "Emergency Cash",
      accountType: "cash",
      currency: "INR",
      openingBalancePaise: rupeesToPaise(15000),
    });

    // Credit card with ₹50,000 liability (owed)
    await accountService.createAccount({
      name: "HDFC Regalia",
      accountType: "credit",
      currency: "INR",
      openingBalancePaise: rupeesToPaise(50000),
    });

    // Net worth = 1,00,000 + 15,000 - 50,000 = ₹65,000
    const nw = await balanceService.getNetWorth();
    assert.strictEqual(nw.netWorthPaise, rupeesToPaise(65000));

    // Liquid Assets for runway MUST be ₹1,15,000 (Bank + Cash only), NOT net worth
    const runway = await runwayService.computeRunway();
    assert.strictEqual(runway.currentLiquidAssetsPaise, rupeesToPaise(115000));
  });

  test("handles surplus cash flow honestly without claiming infinite runway", async () => {
    const bank = await accountService.createAccount({
      name: "Salary Account",
      accountType: "bank",
      currency: "INR",
      openingBalancePaise: rupeesToPaise(50000),
    });

    const now = new Date();
    // Record salary inflow: ₹1,00,000
    await transactionService.recordTransaction({
      accountId: bank.id,
      amountPaise: rupeesToPaise(100000),
      direction: "inflow",
      description: "Monthly Salary",
      occurredAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      status: "posted",
      source: "manual",
    });

    // Record expenses: ₹40,000
    await transactionService.recordTransaction({
      accountId: bank.id,
      amountPaise: rupeesToPaise(40000),
      direction: "outflow",
      description: "Living expenses",
      occurredAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      status: "posted",
      source: "manual",
    });

    const runway = await runwayService.computeRunway();

    assert.strictEqual(runway.status, "surplus");
    assert.strictEqual(runway.runwayDays, null); // Honest: no fake number like 99999 or "infinite"
    assert.strictEqual(runway.runwayMonths, null);
    assert.ok(runway.explanation.includes("Positive cash flow") || runway.explanation.includes("Surplus"));
  });

  test("computes runway months accurately when in a net cash burn state", async () => {
    const bank = await accountService.createAccount({
      name: "Checking",
      accountType: "bank",
      currency: "INR",
      openingBalancePaise: rupeesToPaise(150000), // ₹1,50,000
    });

    const now = new Date();
    // Outflow of ₹30,000 over the past 30 days => ₹30,000/mo burn rate
    for (let i = 1; i <= 30; i++) {
      await transactionService.recordTransaction({
        accountId: bank.id,
        amountPaise: rupeesToPaise(1000),
        direction: "outflow",
        description: `Daily grocery ${i}`,
        occurredAt: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
        status: "posted",
        source: "manual",
      });
    }

    // Reserve threshold: ₹10,000 (1000000 paise).
    // Remaining balance = 150000 - 30000 = 120000.
    // Available above reserve = 120000 - 10000 = 110000.
    // Monthly burn rate = ₹30,000.
    // Runway = ~110000 / 30000 = ~3.66 months.
    const runway = await runwayService.computeRunway(rupeesToPaise(10000));

    assert.ok(runway.monthlyBurnRatePaise > 0);
    assert.ok(runway.runwayMonths !== null && runway.runwayMonths >= 3.0 && runway.runwayMonths <= 4.5);
    assert.ok(runway.runwayDays !== null && runway.runwayDays > 90);

    // Verify scenario stress tests:
    // Conservative scenario (+20% expenses, -10% income) has shorter runway
    assert.ok(
      runway.scenarios.conservative.runwayDays !== null &&
      runway.scenarios.conservative.runwayDays < (runway.runwayDays || 0)
    );
    // Frugal scenario (-20% discretionary) has longer runway
    assert.ok(
      runway.scenarios.frugal.runwayDays !== null &&
      runway.scenarios.frugal.runwayDays > (runway.runwayDays || 0)
    );
  });

  test("returns critical status when liquid balance is below reserve threshold", async () => {
    await accountService.createAccount({
      name: "Low Balance Account",
      accountType: "bank",
      currency: "INR",
      openingBalancePaise: rupeesToPaise(5000), // ₹5,000
    });

    // Reserve threshold is ₹10,000
    const runway = await runwayService.computeRunway(rupeesToPaise(10000));

    assert.strictEqual(runway.status, "critical");
    assert.strictEqual(runway.runwayDays, 0);
    assert.strictEqual(runway.runwayMonths, 0);
  });
});
