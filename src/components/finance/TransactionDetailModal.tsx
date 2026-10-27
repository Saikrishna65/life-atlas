"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  RotateCcw,
  Edit3,
  Calendar,
  Landmark,
  Tag,
  FileText,
  ShieldCheck,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
} from "lucide-react";
import {
  Transaction,
  FinanceAccount,
  FinanceCategory,
  TransactionService,
  formatPaise,
} from "@/lib/finance";

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onEdit: (txn: Transaction) => void;
  transaction: Transaction | null;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  transactionService: TransactionService;
}

export default function TransactionDetailModal({
  isOpen,
  onClose,
  onSuccess,
  onEdit,
  transaction,
  accounts,
  categories,
  transactionService,
}: TransactionDetailModalProps) {
  const [isReversing, setIsReversing] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!transaction) return null;

  const account = accounts.find((a) => a.id === transaction.accountId);
  const category = categories.find((c) => c.id === transaction.categoryId);
  const isTransfer = !!transaction.transferGroupId;
  const isReversed = transaction.status === "reversed";

  const handleReverse = async () => {
    if (!reversalReason.trim()) {
      setErrorMessage("Please state a reason for reversing this transaction.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await transactionService.reverseTransaction(transaction.id, reversalReason.trim());
      setIsReversing(false);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reverse transaction";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transaction Details"
      maxWidthClassName="max-w-md"
    >
      <div className="p-5 sm:p-6 space-y-5">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Top Summary Banner */}
        <div className="p-4 rounded-xl border border-muted bg-surface/70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-sans text-muted-foreground capitalize">
              {isTransfer ? "Internal Transfer" : transaction.direction}
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase ${
                isReversed
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  : transaction.status === "posted"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}
            >
              {transaction.status}
            </span>
          </div>

          <div
            className={`font-display text-2xl sm:text-3xl font-semibold flex items-center gap-1.5 ${
              isReversed
                ? "text-muted-foreground line-through opacity-70"
                : transaction.direction === "inflow"
                ? "text-emerald-400"
                : "text-foreground"
            }`}
          >
            {isTransfer ? (
              <ArrowLeftRight className="w-5 h-5 text-muted-foreground" />
            ) : transaction.direction === "inflow" ? (
              <ArrowUpRight className="w-6 h-6 text-emerald-400" />
            ) : (
              <ArrowDownRight className="w-6 h-6 text-muted-foreground" />
            )}
            <span>
              {transaction.direction === "inflow" ? "+" : "-"}
              {formatPaise(transaction.amountPaise, { currency: transaction.currency })}
            </span>
          </div>

          <div className="text-xs font-medium text-foreground truncate">{transaction.description}</div>
        </div>

        {/* Details Grid */}
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between py-1 border-b border-muted/50">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Landmark className="w-3.5 h-3.5" />
              <span>Account</span>
            </span>
            <span className="font-semibold text-foreground">{account?.name || transaction.accountId}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-muted/50">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Tag className="w-3.5 h-3.5" />
              <span>Category</span>
            </span>
            <span className="font-medium text-foreground">{category?.name || "Uncategorized"}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-muted/50">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>Occurred At</span>
            </span>
            <span className="font-mono text-foreground">
              {new Date(transaction.occurredAt).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>

          {transaction.merchant && (
            <div className="flex items-center justify-between py-1 border-b border-muted/50">
              <span className="text-muted-foreground">Merchant</span>
              <span className="font-medium text-foreground">{transaction.merchant}</span>
            </div>
          )}

          {transaction.notes && (
            <div className="py-1 border-b border-muted/50 space-y-0.5">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Notes / Memos</span>
              </span>
              <p className="text-foreground text-[11px] bg-surface p-2 rounded-lg border border-muted/40">
                {transaction.notes}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between py-1 border-b border-muted/50">
            <span className="text-muted-foreground">Source Provenance</span>
            <span className="font-mono text-muted-foreground uppercase text-[10px]">{transaction.source}</span>
          </div>

          <div className="flex items-center justify-between py-1 text-[10px] text-muted-foreground font-mono">
            <span>ID: {transaction.id}</span>
            <span>v{transaction.version || 1}</span>
          </div>
        </div>

        {/* Non-destructive Reversal Prompt */}
        {isReversing && (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-2.5 animate-fade-in">
            <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Confirm Non-Destructive Reversal</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              This preserves the original transaction in the audit log while marking its status as reversed, restoring account balances accurately.
            </p>
            <input
              type="text"
              required
              placeholder="Reason (e.g. Card refund, duplicate entry, cashier error)"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-surface border border-rose-500/30 text-xs text-foreground focus:outline-none focus:border-rose-400"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsReversing(false)}
                className="px-3 py-1 rounded text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReverse}
                disabled={isSubmitting}
                className="px-3 py-1 rounded bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-colors cursor-pointer"
              >
                Reverse Now
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isReversing && (
          <div className="flex items-center justify-between pt-4 border-t border-muted">
            <div>
              {!isReversed && (
                <button
                  type="button"
                  onClick={() => setIsReversing(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 text-xs hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reverse</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-muted text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Close
              </button>
              {!isReversed && !isTransfer && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit(transaction);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

