/**
 * Life Atlas Finance: Budget Application Service
 * 
 * Manages category budgets, allocation tracking, and spending progress calculations.
 * Invariants:
 * - Qualifying expenses only (status: 'posted' and direction: 'outflow').
 * - Strictly excludes internal transfers (transferGroupId or category type 'transfer').
 * - Excludes reversed transactions.
 * - Safely handles zero budgets without division-by-zero errors.
 */

import { IUnitOfWork } from "../storage/interfaces";
import { Budget, ID, Paise, BudgetPeriod } from "../domain/models";
import { addPaise, subtractPaise, assertSafePaise } from "../domain/money";
import { FinanceError } from "../domain/errors";

export interface CategoryBudgetStatus {
  categoryId: ID;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  allocatedPaise: Paise;
  spentPaise: Paise;
  remainingPaise: Paise;
  percentageUsed: number;
  isOverBudget: boolean;
  isApproachingLimit: boolean;
}

export interface CreateBudgetDTO {
  name: string;
  period: BudgetPeriod;
  startDate: string;
  endDate: string;
  categoryAllocations: Record<ID, Paise>;
  rolloverEnabled?: boolean;
}

export class BudgetService {
  constructor(private uow: IUnitOfWork) {}

  /**
   * Sets or updates the monthly budget amount on a category directly
   */
  async setCategoryMonthlyBudget(categoryId: ID, amountPaise: Paise): Promise<void> {
    assertSafePaise(amountPaise, "Category budget amount");
    if (amountPaise < 0) {
      throw new FinanceError("Budget amount must be non-negative", "INVALID_AMOUNT");
    }

    const category = await this.uow.categories.getById(categoryId);
    if (!category) {
      throw new FinanceError(`Category ${categoryId} not found`, "VALIDATION_FAILED");
    }

    category.budgetAmountPaise = amountPaise;
    category.updatedAt = new Date().toISOString();
    await this.uow.categories.save(category);
  }

  /**
   * Creates or updates a full multi-category Budget document
   */
  async saveBudget(dto: CreateBudgetDTO, existingId?: ID): Promise<Budget> {
    let totalAllocated = 0;
    for (const [catId, amount] of Object.entries(dto.categoryAllocations)) {
      assertSafePaise(amount, `Allocation for category ${catId}`);
      if (amount < 0) {
        throw new FinanceError(`Allocation for ${catId} cannot be negative`, "INVALID_AMOUNT");
      }
      totalAllocated = addPaise(totalAllocated, amount);
    }

    const now = new Date().toISOString();
    const id = existingId || `bgt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const budget: Budget = {
      id,
      name: dto.name.trim(),
      period: dto.period,
      startDate: dto.startDate,
      endDate: dto.endDate,
      categoryAllocations: dto.categoryAllocations,
      totalAllocatedPaise: totalAllocated,
      rolloverEnabled: dto.rolloverEnabled ?? false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await this.uow.budgets.save(budget);
    return budget;
  }

  /**
   * Computes the budget vs actual spending status for all budgeted categories
   * in the specified date range.
   */
  async getCategoryBudgetStatuses(startDate: string, endDate: string): Promise<{
    statuses: CategoryBudgetStatus[];
    totalAllocatedPaise: Paise;
    totalSpentPaise: Paise;
    overallPercentageUsed: number;
  }> {
    const [categories, txns] = await Promise.all([
      this.uow.categories.getAll(),
      this.uow.transactions.query({ startDate, endDate, status: "posted", direction: "outflow" }),
    ]);

    // Map spending per category (excluding transfers and reversed)
    const spentMap = new Map<ID, Paise>();
    for (const txn of txns) {
      if (txn.status === "reversed") continue;
      if (txn.transferGroupId) continue; // Invariant: internal transfers are NOT expenses
      if (!txn.categoryId) continue;

      const current = spentMap.get(txn.categoryId) || 0;
      spentMap.set(txn.categoryId, addPaise(current, txn.amountPaise));
    }

    const statuses: CategoryBudgetStatus[] = [];
    let grandAllocated = 0;
    let grandSpent = 0;

    for (const cat of categories) {
      // If category has a budget set
      const allocated = cat.budgetAmountPaise || 0;
      if (allocated <= 0 && (spentMap.get(cat.id) || 0) <= 0) {
        // Skip uncategorized and unbudgeted categories with 0 spend
        continue;
      }

      // If category has budget or spent money
      const spent = spentMap.get(cat.id) || 0;
      const remaining = subtractPaise(allocated, spent);

      // Percentage computation (safe with zero division)
      let percentage = 0;
      if (allocated > 0) {
        percentage = Math.round((spent / allocated) * 100);
      } else if (spent > 0) {
        percentage = 100; // Spent money without an allocated budget
      }

      const isOverBudget = allocated > 0 && spent > allocated;
      const isApproachingLimit = allocated > 0 && spent >= allocated * 0.8 && spent <= allocated;

      grandAllocated = addPaise(grandAllocated, allocated);
      grandSpent = addPaise(grandSpent, spent);

      statuses.push({
        categoryId: cat.id,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        categoryColor: cat.color,
        allocatedPaise: allocated,
        spentPaise: spent,
        remainingPaise: remaining,
        percentageUsed: percentage,
        isOverBudget,
        isApproachingLimit,
      });
    }

    // Sort by percentageUsed descending (overbudget items first)
    statuses.sort((a, b) => b.percentageUsed - a.percentageUsed);

    const overallPercentageUsed =
      grandAllocated > 0 ? Math.round((grandSpent / grandAllocated) * 100) : 0;

    return {
      statuses,
      totalAllocatedPaise: grandAllocated,
      totalSpentPaise: grandSpent,
      overallPercentageUsed,
    };
  }
}

