"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Plus, Check, Tag } from "lucide-react";
import {
  FinanceCategory,
  BudgetService,
  rupeesToPaise,
  paiseToDecimalString,
  formatPaise,
} from "@/lib/finance";

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  budgetService: BudgetService;
  categories: FinanceCategory[];
  editingCategoryId?: string;
}

export default function BudgetModal({
  isOpen,
  onClose,
  onSuccess,
  budgetService,
  categories,
  editingCategoryId,
}: BudgetModalProps) {
  const [categoryId, setCategoryId] = useState("");
  const [allocatedStr, setAllocatedStr] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Expense categories only for budgeting
  const expenseCategories = categories.filter((c) => c.type === "expense");

  useEffect(() => {
    if (editingCategoryId) {
      setCategoryId(editingCategoryId);
      const cat = categories.find((c) => c.id === editingCategoryId);
      setAllocatedStr(cat?.budgetAmountPaise ? paiseToDecimalString(cat.budgetAmountPaise) : "");
    } else {
      setCategoryId(expenseCategories[0]?.id || "");
      setAllocatedStr("");
    }
    setErrorMessage(null);
  }, [editingCategoryId, isOpen, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!categoryId) {
      setErrorMessage("Please select a category.");
      return;
    }

    let paise = 0;
    try {
      paise = rupeesToPaise(allocatedStr || "0");
      if (paise < 0) {
        setErrorMessage("Budget cannot be negative.");
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid budget amount";
      setErrorMessage(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      await budgetService.setCategoryMonthlyBudget(categoryId, paise);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save budget";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingCategoryId ? "Edit Monthly Budget" : "Set Category Budget"}
      subtitle="Define monthly spending allocations to keep track of limits."
      maxWidthClassName="max-w-md"
    >
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Category Select */}
        <div className="space-y-1">
          <label className="text-xs font-sans font-medium text-muted-foreground">Expense Category</label>
          <select
            value={categoryId}
            disabled={!!editingCategoryId}
            onChange={(e) => {
              const id = e.target.value;
              setCategoryId(id);
              const cat = categories.find((c) => c.id === id);
              if (cat?.budgetAmountPaise) {
                setAllocatedStr(paiseToDecimalString(cat.budgetAmountPaise));
              }
            }}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500 disabled:opacity-60"
          >
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.budgetAmountPaise ? `(Current: ${formatPaise(c.budgetAmountPaise)})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Budget Allocation Input */}
        <div className="space-y-1">
          <label className="text-xs font-sans font-medium text-muted-foreground">
            Monthly Target Limit (₹ INR)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-sm font-mono text-muted-foreground">₹</span>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. 15,000.00"
              value={allocatedStr}
              onChange={(e) => setAllocatedStr(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-surface border border-muted text-base font-mono font-semibold text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            To remove budget tracking for this category, set to 0.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-muted">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-muted text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Monthly Budget</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

