"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Plus, Check, Target, PiggyBank, Calendar } from "lucide-react";
import {
  SavingsGoal,
  SavingsGoalService,
  rupeesToPaise,
  paiseToDecimalString,
} from "@/lib/finance";

interface SavingsGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  savingsGoalService: SavingsGoalService;
  editingGoal?: SavingsGoal | null;
  mode?: "create_or_edit" | "contribute";
}

const GOAL_COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EC4899", "#06B6D4"];

export default function SavingsGoalModal({
  isOpen,
  onClose,
  onSuccess,
  savingsGoalService,
  editingGoal,
  mode = "create_or_edit",
}: SavingsGoalModalProps) {
  const [name, setName] = useState("");
  const [targetAmountStr, setTargetAmountStr] = useState("");
  const [currentAmountStr, setCurrentAmountStr] = useState("0");
  const [contributionStr, setContributionStr] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [color, setColor] = useState("#10B981");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingGoal) {
      setName(editingGoal.name);
      setTargetAmountStr(paiseToDecimalString(editingGoal.targetAmountPaise));
      setCurrentAmountStr(paiseToDecimalString(editingGoal.currentAmountPaise));
      setTargetDate(editingGoal.targetDate?.split("T")[0] || "");
      setColor(editingGoal.color || "#10B981");
      setContributionStr("");
    } else {
      setName("");
      setTargetAmountStr("");
      setCurrentAmountStr("0");
      setContributionStr("");
      setTargetDate("");
      setColor("#10B981");
    }
    setErrorMessage(null);
  }, [editingGoal, isOpen, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    setIsSubmitting(true);
    try {
      if (mode === "contribute" && editingGoal) {
        const paise = rupeesToPaise(contributionStr);
        if (paise <= 0) {
          setErrorMessage("Contribution amount must be greater than zero.");
          setIsSubmitting(false);
          return;
        }
        await savingsGoalService.recordContribution(editingGoal.id, paise);
      } else if (editingGoal) {
        const targetPaise = rupeesToPaise(targetAmountStr);
        const currentPaise = rupeesToPaise(currentAmountStr || "0");
        await savingsGoalService.updateGoal(editingGoal.id, {
          name: name.trim(),
          targetAmountPaise: targetPaise,
          currentAmountPaise: currentPaise,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
          color,
        });
      } else {
        const targetPaise = rupeesToPaise(targetAmountStr);
        const currentPaise = currentAmountStr ? rupeesToPaise(currentAmountStr) : 0;
        await savingsGoalService.createGoal({
          name: name.trim(),
          targetAmountPaise: targetPaise,
          currentAmountPaise: currentPaise,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
          color,
        });
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save savings goal";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === "contribute"
          ? `Record Savings Contribution: ${editingGoal?.name}`
          : editingGoal
          ? "Edit Savings Goal"
          : "Create Savings Goal"
      }
      subtitle={
        mode === "contribute"
          ? "Manually recorded progress. Does not create an account withdrawal or expense."
          : "Track targets for trips, emergency funds, or equipment."
      }
      maxWidthClassName="max-w-md"
    >
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {mode === "contribute" ? (
          /* Contribution input */
          <div className="space-y-2">
            <label className="text-xs font-sans font-medium text-muted-foreground">
              Contribution Amount (₹ INR)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm font-mono text-muted-foreground">₹</span>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. 5,000.00"
                value={contributionStr}
                onChange={(e) => setContributionStr(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-surface border border-muted text-base font-mono font-semibold text-foreground focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Manually tracked progress to encourage savings discipline.
            </p>
          </div>
        ) : (
          /* Create / Edit fields */
          <>
            <div className="space-y-1">
              <label className="text-xs font-sans font-medium text-muted-foreground">Goal Name</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Ladakh Expedition, Sony A7IV Camera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-muted-foreground">Target Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-mono text-muted-foreground">₹</span>
                  <input
                    type="text"
                    required
                    placeholder="1,00,000"
                    value={targetAmountStr}
                    onChange={(e) => setTargetAmountStr(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-surface border border-muted text-xs font-mono text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-muted-foreground">Current Saved (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-mono text-muted-foreground">₹</span>
                  <input
                    type="text"
                    placeholder="0"
                    value={currentAmountStr}
                    onChange={(e) => setCurrentAmountStr(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-surface border border-muted text-xs font-mono text-foreground focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-muted-foreground">Target Date (Optional)</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-muted-foreground">Color</label>
                <div className="flex items-center gap-1.5 pt-1">
                  {GOAL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        color === c ? "scale-110 border-white shadow-xs" : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

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
            <span>
              {mode === "contribute"
                ? "Save Contribution"
                : editingGoal
                ? "Save Changes"
                : "Create Goal"}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

