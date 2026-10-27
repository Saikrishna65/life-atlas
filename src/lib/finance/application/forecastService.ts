/**
 * Life Atlas Finance: Predictive Cash-Flow Forecasting Engine
 * 
 * Deterministic offline projections built on real persisted transaction history,
 * confirmed recurring obligations, and current liquid assets.
 * 
 * Rules:
 * - Strictly integer paise.
 * - Liquid assets include bank/cash and strictly exclude credit card liabilities/limits.
 * - Confirmed recurring rules generate discrete expected future transactions.
 * - Distinguishes actual history from estimates; NEVER injects fake ledger records.
 */

import { IUnitOfWork } from "../storage/interfaces";
import {
  ForecastHorizon,
  CashFlowForecast,
  ProjectedCashFlowPoint,
  UpcomingObligation,
  DataQualityRating,
  ScenarioPlanOptions,
  Paise,
  RecurringRule,
} from "../domain/models";

export class ForecastService {
  constructor(private readonly uow: IUnitOfWork) { }

  /**
   * Generates a deterministic cash-flow forecast for the specified horizon and scenario.
   */
  async generateForecast(
    horizon: ForecastHorizon = "30_days",
    scenarioOptions?: ScenarioPlanOptions,
    reserveThresholdPaise: Paise = 1000000 // default buffer: ₹10,000
  ): Promise<CashFlowForecast> {
    const horizonDays = this.getHorizonDays(horizon);
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endDate = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000).toISOString();

    // 1. Calculate Starting Liquid Assets (positive balances in bank & cash accounts)
    const accounts = await this.uow.accounts.getAll("active");
    const liquidAccounts = accounts.filter(
      (a) => a.accountType === "bank" || a.accountType === "cash" || a.accountType === "savings"
    );

    let startingLiquidPaise: Paise = 0;
    for (const acc of liquidAccounts) {
      if (acc.currentBalancePaise > 0) {
        startingLiquidPaise += acc.currentBalancePaise;
      }
    }

    // 2. Fetch Confirmed Recurring Rules
    const confirmedRules = await this.uow.recurringRules.getAll("confirmed");

    // 3. Analyze Historical Non-Recurring Discretionary Spending (past 30-90 days)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const pastTransactions = await this.uow.transactions.query({
      startDate: ninetyDaysAgo,
      endDate: startDate,
      status: "posted",
    });

    const eligiblePastExpenses = pastTransactions.filter(
      (t) =>
        t.direction === "outflow" &&
        !t.transferGroupId &&
        t.categoryId !== "cat_transfer" &&
        t.status !== "reversed"
    );

    // Calculate historical observation span
    let observationDays = 0;
    if (pastTransactions.length > 0) {
      const earliest = new Date(
        Math.min(...pastTransactions.map((t) => Date.parse(t.occurredAt)))
      );
      observationDays = Math.max(
        1,
        Math.round((now.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24))
      );
    }

    // Determine Data Quality Rating
    let dataQuality: DataQualityRating = "reasonable_coverage";
    let dataQualityExplanation = "Based on >= 30 days of posted transaction history and confirmed recurring rules.";

    if (scenarioOptions && (scenarioOptions.discretionaryCutPercent || scenarioOptions.plannedOneOffExpenses || scenarioOptions.incomeAdjustmentPaise)) {
      dataQuality = "user_adjusted_scenario";
      dataQualityExplanation = "Simulated scenario with user-defined budget adjustments and planned expenses.";
    } else if (observationDays < 7) {
      dataQuality = "insufficient_history";
      dataQualityExplanation = "Less than 7 days of historical transactions recorded. Projections rely primarily on confirmed recurring bills.";
    } else if (observationDays < 30) {
      dataQuality = "limited_history";
      dataQualityExplanation = `Observed ${observationDays} days of transactions. Forecast accuracy will improve as more monthly cycles are recorded.`;
    }

    // Calculate baseline daily discretionary spending (excluding recurring amounts)
    const confirmedRulePatterns = new Set(
      confirmedRules.map((r) => (r.merchant || r.description).toLowerCase().trim())
    );

    const discretionaryExpenses = eligiblePastExpenses.filter((t) => {
      const desc = (t.merchant || t.description).toLowerCase().trim();
      return !confirmedRulePatterns.has(desc);
    });

    const totalDiscretionaryPaise = discretionaryExpenses.reduce(
      (sum, t) => sum + t.amountPaise,
      0
    );
    let dailyDiscretionaryPaise =
      observationDays >= 7 ? Math.round(totalDiscretionaryPaise / observationDays) : 0;

    // Apply scenario discretionary cut if specified
    if (scenarioOptions?.discretionaryCutPercent && scenarioOptions.discretionaryCutPercent > 0) {
      const cutRatio = Math.min(100, Math.max(0, scenarioOptions.discretionaryCutPercent)) / 100;
      dailyDiscretionaryPaise = Math.round(dailyDiscretionaryPaise * (1 - cutRatio));
    }

    // 4. Generate Discrete Future Occurrences for Confirmed Recurring Rules
    const upcomingObligations: UpcomingObligation[] = [];
    const scheduledByDate = new Map<
      string,
      { inflows: Paise; outflows: Paise; descriptions: string[] }
    >();

    for (const rule of confirmedRules) {
      const occurrences = this.computeOccurrencesInRange(rule, startDate, endDate);
      for (const occDate of occurrences) {
        const dateKey = occDate.split("T")[0];
        const dayRecord = scheduledByDate.get(dateKey) || {
          inflows: 0,
          outflows: 0,
          descriptions: [],
        };

        if (rule.direction === "inflow") {
          dayRecord.inflows += rule.amountPaise;
        } else {
          dayRecord.outflows += rule.amountPaise;
        }
        dayRecord.descriptions.push(rule.merchant || rule.description);
        scheduledByDate.set(dateKey, dayRecord);

        upcomingObligations.push({
          ruleId: rule.id,
          merchantOrDescription: rule.merchant || rule.description,
          amountPaise: rule.amountPaise,
          direction: rule.direction,
          frequency: rule.frequency,
          dueDate: occDate,
          categoryId: rule.categoryId,
          isEstimate: true,
        });
      }
    }

    // Add scenario planned one-off expenses
    if (scenarioOptions?.plannedOneOffExpenses) {
      for (const planned of scenarioOptions.plannedOneOffExpenses) {
        const dateKey = planned.date.split("T")[0];
        const dayRecord = scheduledByDate.get(dateKey) || {
          inflows: 0,
          outflows: 0,
          descriptions: [],
        };
        dayRecord.outflows += planned.amountPaise;
        dayRecord.descriptions.push(`[Planned] ${planned.description}`);
        scheduledByDate.set(dateKey, dayRecord);

        upcomingObligations.push({
          ruleId: "scenario_planned",
          merchantOrDescription: planned.description,
          amountPaise: planned.amountPaise,
          direction: "outflow",
          frequency: "monthly",
          dueDate: planned.date,
          isEstimate: true,
        });
      }
    }

    // 5. Day-by-Day Timeline Simulation
    let runningBalance: Paise = startingLiquidPaise;
    let expectedIncomePaise: Paise = scenarioOptions?.incomeAdjustmentPaise || 0;
    let expectedExpensePaise: Paise = 0;
    let lowestProjectedBalancePaise: Paise = startingLiquidPaise;
    let lowBalanceDate: string | undefined;

    const dailyPoints: ProjectedCashFlowPoint[] = [];

    for (let dayOffset = 1; dayOffset <= horizonDays; dayOffset++) {
      const d = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const dateKey = d.toISOString().split("T")[0];
      const isoDate = `${dateKey}T00:00:00.000Z`;

      const scheduled = scheduledByDate.get(dateKey) || {
        inflows: 0,
        outflows: 0,
        descriptions: [],
      };

      const dayInflow = scheduled.inflows;
      const dayOutflow = scheduled.outflows + dailyDiscretionaryPaise;

      runningBalance = runningBalance + dayInflow - dayOutflow;
      expectedIncomePaise += dayInflow;
      expectedExpensePaise += dayOutflow;

      if (runningBalance < lowestProjectedBalancePaise) {
        lowestProjectedBalancePaise = runningBalance;
      }

      if (!lowBalanceDate && runningBalance < reserveThresholdPaise) {
        lowBalanceDate = isoDate;
      }

      dailyPoints.push({
        date: isoDate,
        projectedBalancePaise: runningBalance,
        expectedInflowPaise: dayInflow,
        expectedOutflowPaise: dayOutflow,
        obligationDescriptions: scheduled.descriptions.length > 0 ? scheduled.descriptions : undefined,
      });
    }

    const projectedNetCashFlowPaise = expectedIncomePaise - expectedExpensePaise;
    const projectedLiquidPaise = startingLiquidPaise + projectedNetCashFlowPaise;
    const dailyBurnRatePaise = Math.round(expectedExpensePaise / Math.max(1, horizonDays));

    upcomingObligations.sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate));

    return {
      horizon,
      startDate,
      endDate,
      startingLiquidPaise,
      projectedLiquidPaise,
      expectedIncomePaise,
      expectedExpensePaise,
      projectedNetCashFlowPaise,
      dailyBurnRatePaise,
      lowestProjectedBalancePaise,
      lowBalanceDate,
      upcomingObligations,
      dailyPoints,
      dataQuality,
      dataQualityExplanation,
    };
  }

  private getHorizonDays(horizon: ForecastHorizon): number {
    switch (horizon) {
      case "7_days":
        return 7;
      case "30_days":
        return 30;
      case "90_days":
        return 90;
      case "12_months":
        return 365;
    }
  }

  /**
   * Calculates all discrete calendar dates when a recurring rule falls due within [start, end].
   */
  private computeOccurrencesInRange(
    rule: RecurringRule,
    startIso: string,
    endIso: string
  ): string[] {
    const dates: string[] = [];
    const startTime = new Date(startIso).getTime();
    const endTime = new Date(endIso).getTime();

    let cur = new Date(rule.nextDueDate);

    // If nextDueDate is in the past, advance it forward into range
    while (cur.getTime() < startTime) {
      this.advanceRecurringDate(cur, rule.frequency, rule.interval || 1);
    }

    // Collect occurrences within horizon
    while (cur.getTime() <= endTime) {
      dates.push(cur.toISOString());
      this.advanceRecurringDate(cur, rule.frequency, rule.interval || 1);
    }

    return dates;
  }

  private advanceRecurringDate(d: Date, freq: string, interval: number): void {
    switch (freq) {
      case "daily":
        d.setDate(d.getDate() + interval);
        break;
      case "weekly":
        d.setDate(d.getDate() + 7 * interval);
        break;
      case "biweekly":
        d.setDate(d.getDate() + 14 * interval);
        break;
      case "monthly":
        d.setMonth(d.getMonth() + interval);
        break;
      case "quarterly":
        d.setMonth(d.getMonth() + 3 * interval);
        break;
      case "yearly":
        d.setFullYear(d.getFullYear() + interval);
        break;
      default:
        d.setMonth(d.getMonth() + 1);
    }
  }
}
