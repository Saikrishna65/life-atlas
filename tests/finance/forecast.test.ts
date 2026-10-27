/**
 * Life Atlas Finance: Predictive Cash-Flow Forecasting Test Suite (Phase 4)
 * 
 * Verifies deterministic cash-flow projections, horizon boundaries,
 * confirmed recurring rule integration, what-if scenario modulations,
 * and data quality ratings.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  deleteFinanceDB,
  IndexedDBUnitOfWork,
  ForecastService,
  AccountService,
  TransactionService,
  RecurringService,
  rupeesToPaise,
} from "@/lib/finance";

describe("Life Atlas Finance: Predictive Forecasting Engine", () => {
  let uow: IndexedDBUnitOfWork;
  let forecastService: ForecastService;
  let accountService: AccountService;
  let transactionService: TransactionService;
  let recurringService: RecurringService;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    forecastService = new ForecastService(uow);
    accountService = new AccountService(uow);
    transactionService = new TransactionService(uow);
    recurringService = new RecurringService(uow);
  });

  afterEach(async () => {
    await deleteFinanceDB();
  });

  test("handles empty financial history gracefully with insufficient_history rating", async () => {
    const forecast = await forecastService.generateForecast("30_days");

    assert.strictEqual(forecast.horizon, "30_days");
    assert.strictEqual(forecast.startingLiquidPaise, 0);
    assert.strictEqual(forecast.expectedIncomePaise, 0);
    assert.strictEqual(forecast.expectedExpensePaise, 0);
    assert.strictEqual(forecast.projectedLiquidPaise, 0);
    assert.strictEqual(forecast.dataQuality, "insufficient_history");
    assert.strictEqual(forecast.upcomingObligations.length, 0);
    assert.strictEqual(forecast.dailyPoints.length, 30);
  });

  test("projects cash flow correctly with starting liquid balance and confirmed recurring obligations", async () => {
    // 1. Create a bank account with ₹50,000 liquid balance
    const bank = await accountService.createAccount({
      name: "HDFC Salary",
      accountType: "bank",
      currency: "INR",
      openingBalancePaise: rupeesToPaise(50000),
      metadata: { institutionName: "HDFC Bank" },
    });

    // 2. Add some historical transactions to establish daily run rate
    const now = new Date();
    for (let i = 1; i <= 10; i++) {
      const pastDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString();
      await transactionService.recordTransaction({
        accountId: bank.id,
        amountPaise: rupeesToPaise(500),
        direction: "outflow",
        description: `Daily grocery purchase ${i}`,
        occurredAt: pastDate,
        status: "posted",
        source: "manual",
      });
    }

    // 3. Add a confirmed recurring salary inflow (₹80,000) due in 5 days
    const nextPayDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    await recurringService.createRecurringRule({
      accountId: bank.id,
      amountPaise: rupeesToPaise(80000),
      direction: "inflow",
      description: "Monthly Tech Salary",
      frequency: "monthly",
      interval: 1,
      startDate: now.toISOString(),
      nextDueDate: nextPayDate,
      status: "confirmed",
    });

    // 4. Add a confirmed recurring rent outflow (₹25,000) due in 10 days
    const nextRentDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
    await recurringService.createRecurringRule({
      accountId: bank.id,
      amountPaise: rupeesToPaise(25000),
      direction: "outflow",
      description: "Apartment Rent",
      frequency: "monthly",
      interval: 1,
      startDate: now.toISOString(),
      nextDueDate: nextRentDate,
      status: "confirmed",
    });

    // 5. Add an unconfirmed / detected rule (must NOT be projected as confirmed obligation)
    await recurringService.createRecurringRule({
      accountId: bank.id,
      amountPaise: rupeesToPaise(1999),
      direction: "outflow",
      description: "Gym Membership Candidate",
      frequency: "monthly",
      interval: 1,
      startDate: now.toISOString(),
      nextDueDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      status: "detected",
    });

    // 6. Generate 30-day forecast
    const forecast = await forecastService.generateForecast("30_days");

    assert.strictEqual(forecast.startingLiquidPaise, rupeesToPaise(45000)); // 50000 - (10 * 500)
    assert.strictEqual(forecast.expectedIncomePaise, rupeesToPaise(80000));
    assert.ok(forecast.expectedExpensePaise >= rupeesToPaise(25000)); // Rent + daily baseline
    assert.strictEqual(forecast.upcomingObligations.length, 2); // Only the 2 confirmed rules!
    assert.strictEqual(forecast.upcomingObligations[0].merchantOrDescription, "Monthly Tech Salary");
    assert.strictEqual(forecast.upcomingObligations[1].merchantOrDescription, "Apartment Rent");
    assert.strictEqual(forecast.dataQuality, "limited_history");
  });

  test("accurately applies what-if scenario modifications without mutating database", async () => {
    const bank = await accountService.createAccount({
      name: "ICICI Savings",
      accountType: "bank",
      currency: "INR",
      openingBalancePaise: rupeesToPaise(100000),
      metadata: { institutionName: "ICICI Bank" },
    });

    const now = new Date();
    // 35 days of history for reasonable coverage
    for (let i = 1; i <= 35; i++) {
      const pastDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString();
      await transactionService.recordTransaction({
        accountId: bank.id,
        amountPaise: rupeesToPaise(1000),
        direction: "outflow",
        description: `Daily spend ${i}`,
        occurredAt: pastDate,
        status: "posted",
        source: "manual",
      });
    }

    // Baseline forecast
    const baseline = await forecastService.generateForecast("30_days");
    assert.strictEqual(baseline.dataQuality, "reasonable_coverage");

    // Scenario 1: 30% discretionary cut alone should reduce daily burn rate
    const cutOnly = await forecastService.generateForecast("30_days", {
      discretionaryCutPercent: 30,
    });
    assert.ok(cutOnly.dailyBurnRatePaise < baseline.dailyBurnRatePaise);

    // Scenario 2: Combined with ₹10,000 planned one-off expense in 7 days
    const scenario = await forecastService.generateForecast("30_days", {
      discretionaryCutPercent: 30,
      plannedOneOffExpenses: [
        {
          date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          amountPaise: rupeesToPaise(10000),
          description: "Smartphone Repair",
        },
      ],
    });

    assert.strictEqual(scenario.dataQuality, "user_adjusted_scenario");
    // Upcoming obligations should contain the planned one-off expense
    const plannedOp = scenario.upcomingObligations.find((o) => o.merchantOrDescription === "Smartphone Repair");
    assert.ok(plannedOp);
    assert.strictEqual(plannedOp.amountPaise, rupeesToPaise(10000));

    // Verify database was NOT mutated
    const allTxns = await uow.transactions.query({});
    assert.strictEqual(allTxns.length, 35);
  });

  test("generates deterministic outputs across multiple identical calls", async () => {
    const bank = await accountService.createAccount({
      name: "Cash in Hand",
      accountType: "cash",
      currency: "INR",
      openingBalancePaise: rupeesToPaise(25000),
    });

    const f1 = await forecastService.generateForecast("90_days");
    const f2 = await forecastService.generateForecast("90_days");

    assert.strictEqual(f1.startingLiquidPaise, f2.startingLiquidPaise);
    assert.strictEqual(f1.projectedNetCashFlowPaise, f2.projectedNetCashFlowPaise);
    assert.strictEqual(f1.lowestProjectedBalancePaise, f2.lowestProjectedBalancePaise);
    assert.strictEqual(f1.dailyPoints.length, f2.dailyPoints.length);
  });
});
