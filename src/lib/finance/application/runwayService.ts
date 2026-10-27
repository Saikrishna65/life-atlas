/**
 * Life Atlas Finance: Financial Runway & Affordability Service
 * 
 * Computes how long liquid assets will last at the observed burn rate.
 * 
 * Invariants:
 * - Liquid assets include bank and cash accounts only.
 * - Net worth is NOT spendable cash.
 * - Credit limits and credit card liabilities are strictly excluded from liquid assets.
 * - Handles surplus cash flow (net inflow) without claiming "infinite" runway.
 */

import { IUnitOfWork } from "../storage/interfaces";
import {
  RunwayEstimate,
  Paise,
  UpcomingObligation,
} from "../domain/models";
import { ForecastService } from "./forecastService";

export interface LowBalanceAlert {
  id: string;
  expectedDate: string;
  projectedBalancePaise: Paise;
  thresholdPaise: Paise;
  triggerObligation?: string;
  severity: "warning" | "critical";
  message: string;
}

export class RunwayService {
  private forecastService: ForecastService;

  constructor(private readonly uow: IUnitOfWork) {
    this.forecastService = new ForecastService(uow);
  }

  /**
   * Computes the current financial runway across baseline, conservative, and frugal scenarios.
   */
  async computeRunway(
    reserveThresholdPaise: Paise = 1000000 // default buffer: ₹10,000 (1000000 paise)
  ): Promise<RunwayEstimate> {
    const now = new Date();
    const accounts = await this.uow.accounts.getAll("active");

    // 1. Calculate Spendable Liquid Assets (bank + cash only; strictly positive)
    const liquidAccounts = accounts.filter(
      (a) => a.accountType === "bank" || a.accountType === "cash" || a.accountType === "savings"
    );

    let currentLiquidAssetsPaise: Paise = 0;
    for (const acc of liquidAccounts) {
      if (acc.currentBalancePaise > 0) {
        currentLiquidAssetsPaise += acc.currentBalancePaise;
      }
    }

    const availableAboveReservePaise = Math.max(0, currentLiquidAssetsPaise - reserveThresholdPaise);

    // 2. Fetch recent 30-90 days history for burn rate
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const todayIso = now.toISOString();

    const pastTransactions = await this.uow.transactions.query({
      startDate: thirtyDaysAgo,
      endDate: todayIso,
      status: "posted",
    });

    const nonTransferTxns = pastTransactions.filter(
      (t) => !t.transferGroupId && t.categoryId !== "cat_transfer" && t.status !== "reversed"
    );

    const pastInflowPaise = nonTransferTxns
      .filter((t) => t.direction === "inflow")
      .reduce((sum, t) => sum + t.amountPaise, 0);

    const pastOutflowPaise = nonTransferTxns
      .filter((t) => t.direction === "outflow")
      .reduce((sum, t) => sum + t.amountPaise, 0);

    // Also factor in confirmed recurring commitments
    const confirmedRules = await this.uow.recurringRules.getAll("confirmed");
    let monthlyRecurringOutflow = 0;
    let monthlyRecurringInflow = 0;

    for (const rule of confirmedRules) {
      const monthlyEquiv = this.convertToMonthlyPaise(rule.amountPaise, rule.frequency);
      if (rule.direction === "outflow") {
        monthlyRecurringOutflow += monthlyEquiv;
      } else {
        monthlyRecurringInflow += monthlyEquiv;
      }
    }

    // Determine representative monthly inflow and outflow
    const effectiveMonthlyInflow = Math.max(pastInflowPaise, monthlyRecurringInflow);
    const effectiveMonthlyOutflow = Math.max(pastOutflowPaise, monthlyRecurringOutflow);

    // Monthly Net Burn Rate = Outflows - Inflows
    const baselineMonthlyBurn = effectiveMonthlyOutflow - effectiveMonthlyInflow;
    const dailyBurnRatePaise = baselineMonthlyBurn > 0 ? Math.round(baselineMonthlyBurn / 30) : 0;

    // 3. Status and Runway Days Calculation
    let runwayDays: number | null = null;
    let runwayMonths: number | null = null;
    let status: RunwayEstimate["status"] = "stable";
    let explanation = "";

    if (currentLiquidAssetsPaise <= 0) {
      status = "depleted";
      runwayDays = 0;
      runwayMonths = 0;
      explanation = "Liquid reserves are fully depleted. No spendable cash or bank balances available.";
    } else if (currentLiquidAssetsPaise <= reserveThresholdPaise) {
      status = "critical";
      runwayDays = 0;
      runwayMonths = 0;
      explanation = `Reserves are below your safety threshold of ₹${(reserveThresholdPaise / 100).toLocaleString("en-IN")}.`;
    } else if (pastTransactions.length === 0 && confirmedRules.length === 0) {
      status = "insufficient_data";
      runwayDays = null;
      runwayMonths = null;
      explanation = "Not enough transaction history or confirmed bills to calculate an accurate burn rate.";
    } else if (baselineMonthlyBurn <= 0) {
      // Net surplus!
      status = "surplus";
      runwayDays = null;
      runwayMonths = null;
      explanation = "Positive cash flow: monthly income meets or exceeds all monthly obligations.";
    } else {
      // In net burn
      runwayDays = Math.floor(availableAboveReservePaise / Math.max(1, dailyBurnRatePaise));
      runwayMonths = Math.round((runwayDays / 30.4375) * 10) / 10;

      if (currentLiquidAssetsPaise <= reserveThresholdPaise) {
        status = "critical";
        explanation = `Reserves are below your safety threshold of ₹${(reserveThresholdPaise / 100).toLocaleString("en-IN")}.`;
      } else if (runwayDays <= 60) {
        status = "warning";
        explanation = `At the current burn rate, liquid assets will reach the safety reserve in ~${runwayDays} days.`;
      } else {
        status = "stable";
        explanation = `Healthy liquid runway of ~${runwayMonths} months above your reserve floor.`;
      }
    }

    // 4. Scenarios
    // Conservative: +20% expenses, -10% income
    const conservativeOutflow = Math.round(effectiveMonthlyOutflow * 1.2);
    const conservativeInflow = Math.round(effectiveMonthlyInflow * 0.9);
    const conservativeBurn = conservativeOutflow - conservativeInflow;
    const conservativeDays =
      conservativeBurn > 0
        ? Math.floor(availableAboveReservePaise / Math.max(1, Math.round(conservativeBurn / 30)))
        : null;

    // Frugal: -20% discretionary expenses
    const frugalOutflow = Math.round(effectiveMonthlyOutflow * 0.8);
    const frugalBurn = frugalOutflow - effectiveMonthlyInflow;
    const frugalDays =
      frugalBurn > 0
        ? Math.floor(availableAboveReservePaise / Math.max(1, Math.round(frugalBurn / 30)))
        : null;

    return {
      currentLiquidAssetsPaise,
      reserveThresholdPaise,
      availableAboveReservePaise,
      monthlyBurnRatePaise: Math.max(0, baselineMonthlyBurn),
      dailyBurnRatePaise,
      runwayDays,
      runwayMonths,
      status,
      explanation,
      scenarios: {
        baseline: {
          runwayDays,
          monthlyBurnPaise: Math.max(0, baselineMonthlyBurn),
        },
        conservative: {
          runwayDays: conservativeDays,
          monthlyBurnPaise: Math.max(0, conservativeBurn),
        },
        frugal: {
          runwayDays: frugalDays,
          monthlyBurnPaise: Math.max(0, frugalBurn),
        },
      },
    };
  }

  /**
   * Evaluates if any upcoming obligations or baseline burn will breach the reserve threshold
   * within the next 30 days.
   */
  async evaluateLowBalanceAlerts(
    thresholdPaise: Paise = 1000000
  ): Promise<LowBalanceAlert[]> {
    const forecast = await this.forecastService.generateForecast("30_days", undefined, thresholdPaise);
    const alerts: LowBalanceAlert[] = [];

    if (forecast.lowBalanceDate) {
      alerts.push({
        id: `alert_low_${forecast.lowBalanceDate.split("T")[0]}`,
        expectedDate: forecast.lowBalanceDate,
        projectedBalancePaise: forecast.lowestProjectedBalancePaise,
        thresholdPaise,
        severity: forecast.lowestProjectedBalancePaise < 0 ? "critical" : "warning",
        message: `Projected liquid balance drops below ₹${(thresholdPaise / 100).toLocaleString(
          "en-IN"
        )} on ${forecast.lowBalanceDate.split("T")[0]}.`,
      });
    }

    return alerts;
  }

  private convertToMonthlyPaise(amountPaise: Paise, frequency: string): Paise {
    switch (frequency) {
      case "daily":
        return amountPaise * 30;
      case "weekly":
        return Math.round((amountPaise * 52) / 12);
      case "biweekly":
        return Math.round((amountPaise * 26) / 12);
      case "monthly":
        return amountPaise;
      case "quarterly":
        return Math.round(amountPaise / 3);
      case "yearly":
        return Math.round(amountPaise / 12);
      default:
        return amountPaise;
    }
  }
}
