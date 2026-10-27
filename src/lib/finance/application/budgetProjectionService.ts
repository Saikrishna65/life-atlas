/**
 * Life Atlas Finance: Budget-Aware Forecasting & Scenario Service
 * 
 * Estimates end-of-period category spending and budget utilization.
 * Evaluates what-if scenario planning without mutating actual financial records.
 */

import { IUnitOfWork } from "../storage/interfaces";
import { CategoryBudgetProjection, ScenarioPlanOptions, Paise } from "../domain/models";

export class BudgetProjectionService {
  constructor(private readonly uow: IUnitOfWork) {}

  /**
   * Projects end-of-period category spending based on elapsed days, burn rates,
   * and scheduled obligations.
   */
  async projectEndOfMonthBudgets(
    startDateIso: string,
    endDateIso: string
  ): Promise<CategoryBudgetProjection[]> {
    const start = new Date(startDateIso);
    const end = new Date(endDateIso);
    const now = new Date();

    const totalPeriodDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(1, Math.min(totalPeriodDays, Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))));
    const daysRemaining = Math.max(0, totalPeriodDays - elapsedDays);

    // Fetch active budgets and categories
    const [allBudgets, allCategories, txns] = await Promise.all([
      this.uow.budgets.getAll(),
      this.uow.categories.getAll(),
      this.uow.transactions.query({
        startDate: startDateIso,
        endDate: now.toISOString(),
        status: "posted",
      }),
    ]);

    const activeBudget = allBudgets.find((b) => b.startDate === startDateIso) || allBudgets[0];
    if (!activeBudget) {
      return [];
    }

    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

    // Compute actual spending per category in current period
    const spentByCategory = new Map<string, number>();
    for (const t of txns) {
      if (
        t.direction === "outflow" &&
        t.categoryId &&
        t.categoryId !== "cat_transfer" &&
        !t.transferGroupId &&
        t.status !== "reversed"
      ) {
        const cur = spentByCategory.get(t.categoryId) || 0;
        spentByCategory.set(t.categoryId, cur + t.amountPaise);
      }
    }

    const projections: CategoryBudgetProjection[] = [];

    for (const [catId, allocatedPaise] of Object.entries(activeBudget.categoryAllocations)) {
      if (allocatedPaise <= 0) continue;

      const cat = categoryMap.get(catId);
      const categoryName = cat?.name || "Category";
      const spentSoFarPaise = spentByCategory.get(catId) || 0;

      // Calculate daily burn rate so far in this period
      const dailySpendRate = Math.round(spentSoFarPaise / elapsedDays);

      // End of month projected spending
      const projectedEndOfMonthPaise = spentSoFarPaise + Math.round(dailySpendRate * daysRemaining);
      const remainingBudgetPaise = Math.max(0, allocatedPaise - spentSoFarPaise);
      const utilizationPercent = Math.round((spentSoFarPaise / allocatedPaise) * 100);
      const projectedUtilizationPercent = Math.round((projectedEndOfMonthPaise / allocatedPaise) * 100);

      let riskLevel: CategoryBudgetProjection["riskLevel"] = "normal";
      if (projectedUtilizationPercent > 100) {
        riskLevel = "over_budget";
      } else if (projectedUtilizationPercent >= 80) {
        riskLevel = "approaching";
      }

      projections.push({
        categoryId: catId,
        categoryName,
        allocatedPaise,
        spentSoFarPaise,
        projectedEndOfMonthPaise,
        remainingBudgetPaise,
        utilizationPercent,
        projectedUtilizationPercent,
        riskLevel,
        daysRemainingInPeriod: daysRemaining,
      });
    }

    projections.sort((a, b) => b.projectedUtilizationPercent - a.projectedUtilizationPercent);
    return projections;
  }
}

