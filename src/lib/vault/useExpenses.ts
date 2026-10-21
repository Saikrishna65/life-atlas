"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ExpenseRecord,
  ExpenseCategory,
  TripRecord,
  DepositRefundStatus,
  ID,
} from "./types";
import {
  getExpensesForTrip,
  saveExpense,
  deleteExpense,
  getTrip,
  saveTrip,
  isIndexedDBAvailable,
} from "./storage";
import { notifyVaultChange } from "./useTripVault";

export const ALL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "TRANSPORT",
  "ACCOMMODATION",
  "FOOD",
  "RENTAL",
  "FUEL",
  "ACTIVITIES",
  "PERMITS",
  "SHOPPING",
  "EMERGENCY",
  "MISC",
];

export interface CategoryBudgetDetail {
  category: ExpenseCategory;
  spent: number;
  allocated: number;
  percent: number;
  isOver: boolean;
}

export interface ExpenseStats {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  percentSpent: number;
  isOverBudget: boolean;
  byCategory: Record<ExpenseCategory, CategoryBudgetDetail>;
  totalDepositsPaid: number;
  pendingRefundAmount: number;
  refundedAmount: number;
  deductedAmount: number;
  depositLedger: ExpenseRecord[];
  expenseCount: number;
}

export function useExpenses(tripId: string) {
  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tripId || !isIndexedDBAvailable()) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const [tripData, expenseList] = await Promise.all([
        getTrip(tripId),
        getExpensesForTrip(tripId),
      ]);
      setTrip(tripData);
      setExpenses(expenseList);
    } catch (err) {
      console.error("Failed loading expenses from vault:", err);
      setError("Unable to load expenses and budget records.");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    let mounted = true;
    if (!tripId) return;

    (async () => {
      try {
        const [tripData, expenseList] = await Promise.all([
          getTrip(tripId),
          getExpensesForTrip(tripId),
        ]);
        if (mounted) {
          setTrip(tripData);
          setExpenses(expenseList);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed initial expense load:", err);
          setError("Failed to load expenses.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    const handleVaultChange = () => {
      loadData();
    };

    window.addEventListener("vault-storage-change", handleVaultChange);
    return () => {
      mounted = false;
      window.removeEventListener("vault-storage-change", handleVaultChange);
    };
  }, [tripId, loadData]);

  // Aggregated financial metrics
  const stats: ExpenseStats = useMemo(() => {
    const totalBudget = trip?.budgetTotal || 0;
    const categoryAllocations = trip?.categoryBudgets || {};

    let totalSpent = 0;
    let totalDepositsPaid = 0;
    let pendingRefundAmount = 0;
    let refundedAmount = 0;
    let deductedAmount = 0;

    const categorySpentMap: Record<ExpenseCategory, number> = {
      TRANSPORT: 0,
      ACCOMMODATION: 0,
      FOOD: 0,
      RENTAL: 0,
      FUEL: 0,
      ACTIVITIES: 0,
      PERMITS: 0,
      SHOPPING: 0,
      EMERGENCY: 0,
      MISC: 0,
    };

    const depositItems: ExpenseRecord[] = [];

    for (const exp of expenses) {
      const amount = Number(exp.amount) || 0;

      if (exp.isDeposit) {
        depositItems.push(exp);
        totalDepositsPaid += amount;

        if (exp.depositRefundStatus === "PENDING") {
          pendingRefundAmount += amount;
          // Pending deposit is not counted as permanent expenditure yet
        } else if (exp.depositRefundStatus === "REFUNDED") {
          refundedAmount += (exp.refundAmount !== undefined ? Number(exp.refundAmount) : amount);
          // If refund was partial, count the difference as spent
          if (exp.refundAmount !== undefined && exp.refundAmount < amount) {
            const deduction = amount - exp.refundAmount;
            deductedAmount += deduction;
            totalSpent += deduction;
            categorySpentMap[exp.category] = (categorySpentMap[exp.category] || 0) + deduction;
          }
        } else if (exp.depositRefundStatus === "DEDUCTED") {
          deductedAmount += amount;
          totalSpent += amount;
          categorySpentMap[exp.category] = (categorySpentMap[exp.category] || 0) + amount;
        }
      } else {
        // Standard operational expense
        totalSpent += amount;
        categorySpentMap[exp.category] = (categorySpentMap[exp.category] || 0) + amount;
      }
    }

    const remainingBudget = totalBudget - totalSpent;
    const percentSpent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const isOverBudget = totalSpent > totalBudget;

    // Build byCategory map
    const byCategory: Record<ExpenseCategory, CategoryBudgetDetail> = {} as Record<
      ExpenseCategory,
      CategoryBudgetDetail
    >;

    for (const cat of ALL_EXPENSE_CATEGORIES) {
      const spent = categorySpentMap[cat] || 0;
      // If user specified allocation, use it; otherwise fallback to default proportion
      const allocated = categoryAllocations[cat] !== undefined ? categoryAllocations[cat]! : 0;
      const percent = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
      byCategory[cat] = {
        category: cat,
        spent,
        allocated,
        percent,
        isOver: allocated > 0 && spent > allocated,
      };
    }

    return {
      totalBudget,
      totalSpent,
      remainingBudget,
      percentSpent,
      isOverBudget,
      byCategory,
      totalDepositsPaid,
      pendingRefundAmount,
      refundedAmount,
      deductedAmount,
      depositLedger: depositItems,
      expenseCount: expenses.length,
    };
  }, [trip, expenses]);

  // Actions
  const addExpense = useCallback(
    async (
      record: Omit<ExpenseRecord, "id" | "tripId" | "createdAt" | "updatedAt">
    ): Promise<ExpenseRecord> => {
      const newExp: ExpenseRecord = {
        ...record,
        id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tripId,
        currency: record.currency || trip?.currency || "INR",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveExpense(newExp);
      notifyVaultChange();
      await loadData();
      return saved;
    },
    [tripId, trip, loadData]
  );

  const updateExpense = useCallback(
    async (record: ExpenseRecord): Promise<ExpenseRecord> => {
      const updated: ExpenseRecord = {
        ...record,
        updatedAt: new Date().toISOString(),
      };
      const saved = await saveExpense(updated);
      notifyVaultChange();
      await loadData();
      return saved;
    },
    [loadData]
  );

  const removeExpense = useCallback(
    async (id: ID) => {
      await deleteExpense(id);
      notifyVaultChange();
      await loadData();
    },
    [loadData]
  );

  const updateCategoryBudgets = useCallback(
    async (budgets: Partial<Record<ExpenseCategory, number>>) => {
      if (!trip) return;
      const updatedTrip: TripRecord = {
        ...trip,
        categoryBudgets: budgets,
        updatedAt: new Date().toISOString(),
      };
      await saveTrip(updatedTrip);
      setTrip(updatedTrip);
      notifyVaultChange();
    },
    [trip]
  );

  const updateDepositRefund = useCallback(
    async (id: ID, status: DepositRefundStatus, refundAmount?: number) => {
      const current = expenses.find((e) => e.id === id);
      if (!current) return;

      await updateExpense({
        ...current,
        depositRefundStatus: status,
        refundAmount: status === "REFUNDED" ? (refundAmount !== undefined ? refundAmount : current.amount) : undefined,
      });
    },
    [expenses, updateExpense]
  );

  return {
    trip,
    expenses,
    stats,
    isLoading,
    error,
    addExpense,
    updateExpense,
    removeExpense,
    updateCategoryBudgets,
    updateDepositRefund,
    refresh: loadData,
  };
}
