/**
 * Life Atlas Finance: Balance & Reporting Application Service
 * 
 * Computes deterministic account balances, net worth, cash flow reports,
 * category spending breakdowns, and cash flow trend timelines.
 */

import { IUnitOfWork } from "../storage/interfaces";
import { ID, Paise } from "../domain/models";
import {
  computeAccountBalances,
  calculateNetWorthPaise,
  computeCashFlow,
  AccountBalanceComputation,
  CashFlowSummary,
} from "../domain/ledger";
import { addPaise, subtractPaise } from "../domain/money";
import { FinanceError } from "../domain/errors";

export interface CategorySpendingItem {
  categoryId: ID;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  totalSpentPaise: Paise;
  percentage: number;
}

export interface CashFlowTimelinePoint {
  dateKey: string;
  dateLabel: string;
  incomePaise: Paise;
  expensePaise: Paise;
  netPaise: Paise;
}

export class BalanceService {
  constructor(private uow: IUnitOfWork) {}

  /**
   * Retrieves both posted balance and available balance (taking pending transactions into account)
   */
  async getAccountBalances(accountId: ID): Promise<AccountBalanceComputation> {
    const account = await this.uow.accounts.getById(accountId);
    if (!account) {
      throw new FinanceError(`Account ${accountId} not found`, "INVALID_ACCOUNT");
    }

    const txns = await this.uow.transactions.query({ accountId });
    return computeAccountBalances(account, txns);
  }

  /**
   * Computes the current net worth across all active accounts
   * Net Worth = Total Assets - Total Liabilities
   */
  async getNetWorth(): Promise<{
    totalAssetsPaise: Paise;
    totalLiabilitiesPaise: Paise;
    netWorthPaise: Paise;
  }> {
    const accounts = await this.uow.accounts.getAll("active");
    return calculateNetWorthPaise(accounts);
  }

  /**
   * Computes realized cash flow metrics for a given date range
   * Transfers between user accounts are strictly excluded from income and expenses.
   */
  async getCashFlow(startDate: string, endDate: string): Promise<CashFlowSummary> {
    const [txns, categories] = await Promise.all([
      this.uow.transactions.query({ startDate, endDate }),
      this.uow.categories.getAll(),
    ]);

    const transferCategoryIds = new Set(
      categories.filter((c) => c.type === "transfer").map((c) => c.id)
    );

    return computeCashFlow(txns, transferCategoryIds);
  }

  /**
   * Computes spending breakdown grouped by category for a period
   * Transfers and reversed transactions are strictly excluded.
   */
  async getCategorySpendingBreakdown(startDate: string, endDate: string): Promise<CategorySpendingItem[]> {
    const [txns, categories] = await Promise.all([
      this.uow.transactions.query({ startDate, endDate, status: "posted", direction: "outflow" }),
      this.uow.categories.getAll(),
    ]);

    const catMap = new Map(categories.map((c) => [c.id, c]));
    const transferCategoryIds = new Set(
      categories.filter((c) => c.type === "transfer").map((c) => c.id)
    );

    const spendMap = new Map<ID, Paise>();
    let totalSpend = 0;

    for (const txn of txns) {
      if (txn.status === "reversed") continue;
      if (txn.transferGroupId) continue; // Exclude transfers
      if (txn.categoryId && transferCategoryIds.has(txn.categoryId)) continue;

      const catId = txn.categoryId || "cat_uncategorized";
      const current = spendMap.get(catId) || 0;
      spendMap.set(catId, addPaise(current, txn.amountPaise));
      totalSpend = addPaise(totalSpend, txn.amountPaise);
    }

    const items: CategorySpendingItem[] = [];

    for (const [catId, amount] of spendMap.entries()) {
      const cat = catMap.get(catId);
      const name = cat?.name || "Uncategorized";
      const color = cat?.color || "#94A3B8";
      const icon = cat?.icon || "MoreHorizontal";
      const percentage = totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0;

      items.push({
        categoryId: catId,
        categoryName: name,
        categoryColor: color,
        categoryIcon: icon,
        totalSpentPaise: amount,
        percentage,
      });
    }

    // Sort descending by spend
    items.sort((a, b) => b.totalSpentPaise - a.totalSpentPaise);
    return items;
  }

  /**
   * Computes income vs expense timeline aggregated by day or month across the selected date range
   */
  async getCashFlowTimeline(startDate: string, endDate: string): Promise<CashFlowTimelinePoint[]> {
    const [txns, categories] = await Promise.all([
      this.uow.transactions.query({ startDate, endDate, status: "posted" }),
      this.uow.categories.getAll(),
    ]);

    const transferCategoryIds = new Set(
      categories.filter((c) => c.type === "transfer").map((c) => c.id)
    );

    // Group by YYYY-MM-DD
    const pointMap = new Map<string, { income: Paise; expense: Paise }>();

    for (const txn of txns) {
      if (txn.status === "reversed") continue;
      if (txn.transferGroupId) continue;
      if (txn.categoryId && transferCategoryIds.has(txn.categoryId)) continue;

      const dateKey = txn.occurredAt.split("T")[0];
      const entry = pointMap.get(dateKey) || { income: 0, expense: 0 };

      if (txn.direction === "inflow") {
        entry.income = addPaise(entry.income, txn.amountPaise);
      } else {
        entry.expense = addPaise(entry.expense, txn.amountPaise);
      }

      pointMap.set(dateKey, entry);
    }

    const sortedKeys = Array.from(pointMap.keys()).sort();
    return sortedKeys.map((k) => {
      const val = pointMap.get(k)!;
      // Format readable date label (e.g. "Oct 24")
      const parsed = new Date(k);
      const label = parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      return {
        dateKey: k,
        dateLabel: label,
        incomePaise: val.income,
        expensePaise: val.expense,
        netPaise: subtractPaise(val.income, val.expense),
      };
    });
  }
}
