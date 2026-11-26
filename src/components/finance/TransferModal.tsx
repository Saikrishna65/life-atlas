"use client";

import FinanceSelect from "@/components/finance/FinanceSelect";

import React, { useState } from "react";
import { Modal } from "@/components/finance/FinanceDialog";
import { ArrowLeftRight, ArrowRight } from "lucide-react";
import {
  FinanceAccount,
  TransactionService,
  rupeesToPaise,
  formatPaise,
} from "@/lib/finance";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transactionService: TransactionService;
  accounts: FinanceAccount[];
  defaultSourceAccountId?: string;
}

export default function TransferModal(props: TransferModalProps) {
  return props.isOpen ? <TransferForm {...props} /> : null;
}
function TransferForm({
  isOpen,
  onClose,
  onSuccess,
  transactionService,
  accounts,
  defaultSourceAccountId,
}: TransferModalProps) {
  const activeAccounts = accounts.filter((a) => a.status === "active");
  const initialSource =
    activeAccounts.find((a) => a.id === defaultSourceAccountId) ||
    activeAccounts[0];
  const [sourceAccountId, setSourceAccountId] = useState(
    initialSource?.id || "",
  );
  const [destinationAccountId, setDestinationAccountId] = useState(
    activeAccounts.find(
      (a) =>
        a.id !== initialSource?.id && a.currency === initialSource?.currency,
    )?.id || "",
  );
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sourceAccount = accounts.find((a) => a.id === sourceAccountId);
  const destinationAccount = accounts.find(
    (a) => a.id === destinationAccountId,
  );

  // Compute preview paise
  let previewPaise = 0;
  try {
    previewPaise = amountStr.trim() ? rupeesToPaise(amountStr) : 0;
  } catch {
    previewPaise = 0;
  }

  const isCardRepayment = destinationAccount?.accountType === "credit";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!sourceAccountId || !destinationAccountId) {
      setErrorMessage("Please select both source and destination accounts.");
      return;
    }

    if (sourceAccountId === destinationAccountId) {
      setErrorMessage("Source and destination accounts must be distinct.");
      return;
    }

    let paise = 0;
    try {
      paise = rupeesToPaise(amountStr);
      if (paise <= 0) {
        setErrorMessage("Transfer amount must be strictly positive.");
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid amount";
      setErrorMessage(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      await transactionService.recordTransfer({
        sourceAccountId,
        destinationAccountId,
        amountPaise: paise,
        description: description.trim() || undefined,
        occurredAt: new Date(occurredAt).toISOString(),
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to execute transfer";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer Funds"
      subtitle="Balanced movement between your accounts. Net worth remains unchanged."
      maxWidthClassName="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Source & Destination Account Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-sans font-medium text-muted-foreground">
              From (Source)
            </label>
            <FinanceSelect
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
            >
              {activeAccounts.map((a) => (
                <option
                  key={a.id}
                  value={a.id}
                  disabled={a.id === destinationAccountId}
                >
                  {a.name} ({a.accountType})
                </option>
              ))}
            </FinanceSelect>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-medium text-muted-foreground">
              To (Destination)
            </label>
            <FinanceSelect
              value={destinationAccountId}
              onChange={(e) => setDestinationAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
            >
              {activeAccounts.map((a) => (
                <option
                  key={a.id}
                  value={a.id}
                  disabled={
                    a.id === sourceAccountId ||
                    a.currency !== sourceAccount?.currency
                  }
                >
                  {a.name} ({a.accountType})
                </option>
              ))}
            </FinanceSelect>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-1">
          <label className="text-xs font-sans font-medium text-muted-foreground">
            Amount ({sourceAccount?.currency || "INR"})
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-sm font-mono text-muted-foreground">
              {sourceAccount?.currency === "INR"
                ? "₹"
                : sourceAccount?.currency || "₹"}
            </span>
            <input
              type="text"
              required
              autoFocus
              placeholder="0.00"
              value={amountStr}
              aria-label="Transfer amount"
              inputMode="decimal"
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-surface border border-muted text-base font-mono font-semibold text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Transfer Visual Preview Banner */}
        {previewPaise > 0 && sourceAccount && destinationAccount && (
          <div className="p-3.5 rounded-xl border border-muted bg-surface/70 space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground font-mono text-[11px]">
              <span className="truncate max-w-[40%] font-semibold text-foreground">
                {sourceAccount.name}
              </span>
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10">
                <ArrowLeftRight className="w-3 h-3" />
                <span>{formatPaise(previewPaise)}</span>
              </div>
              <span className="truncate max-w-[40%] font-semibold text-foreground text-right">
                {destinationAccount.name}
              </span>
            </div>

            <div className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-muted/50">
              {isCardRepayment ? (
                <span className="text-emerald-400">
                  Credit Card Settlement: Reduces bank balance and reduces
                  outstanding debt owed by {formatPaise(previewPaise)}. Zero net
                  worth change.
                </span>
              ) : (
                <span>
                  Internal Reallocation: Money moves between your accounts with
                  zero impact on overall net worth and zero income/expense
                  inflation.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Description & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-sans font-medium text-muted-foreground">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder={
                isCardRepayment
                  ? "Credit Card Bill Payment"
                  : "Monthly Savings Transfer"
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-medium text-muted-foreground">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>
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
            disabled={isSubmitting || accounts.length < 2}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Confirm Transfer</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
