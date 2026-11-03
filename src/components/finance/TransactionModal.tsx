"use client";
import { tripDetailCategoryId } from "@/lib/finance/trips/policy";

import FinanceSelect from "@/components/finance/FinanceSelect";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/finance/FinanceDialog";
import { Plus, Check, ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  Transaction,
  FinanceAccount,
  FinanceCategory,
  SavingsPocket,
  TransactionService,
  rupeesToPaise,
  paiseToDecimalString,
  TransactionDirection,
  TransactionStatus,
} from "@/lib/finance";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transactionService: TransactionService;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  pockets?: SavingsPocket[];
  editingTransaction?: Transaction | null;
  defaultAccountId?: string;
  defaultTripId?: string;
}

export default function TransactionModal({
  isOpen,
  onClose,
  onSuccess,
  transactionService,
  accounts,
  categories,
  pockets,
  editingTransaction,
  defaultAccountId,
  defaultTripId,
}: TransactionModalProps) {
  const [tripChoice,setTripChoice]=useState("__auto");
  const [tripOptions,setTripOptions]=useState<import("@/lib/vault/types").TripRecord[]>([]);
  useEffect(()=>{if(isOpen)void transactionService.availableTrips().then(setTripOptions).catch(()=>setTripOptions([]));},[isOpen,transactionService]);
  const [direction, setDirection] = useState<TransactionDirection>("outflow");
  const [amountStr, setAmountStr] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [pocketId, setPocketId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [merchant, setMerchant] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [status, setStatus] = useState<TransactionStatus>("posted");
  const [notes, setNotes] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTripChoice(editingTransaction?.tripAssignment?.mode==="excluded"?"__normal":editingTransaction?.tripAssignment?.mode==="manual"?editingTransaction.tripAssignment.tripId || "__normal":defaultTripId || "__auto");
    if (editingTransaction) {
      setDirection(editingTransaction.direction);
      setAmountStr(paiseToDecimalString(editingTransaction.amountPaise));
      setAccountId(editingTransaction.accountId);
      setCategoryId(tripDetailCategoryId(editingTransaction) || "");
      setPocketId(editingTransaction.pocketId || "");
      setDescription(editingTransaction.description);
      setMerchant(editingTransaction.merchant || "");
      setOccurredAt(new Date(Date.parse(editingTransaction.occurredAt)-new Date(editingTransaction.occurredAt).getTimezoneOffset()*60000).toISOString().slice(0,16));
      setStatus(editingTransaction.status);
      setNotes(editingTransaction.notes || "");
      setCorrectionReason("");
    } else {
      setDirection("outflow");
      setAmountStr("");
      setAccountId(defaultAccountId || accounts[0]?.id || "");
      setCategoryId("");
      setPocketId("");
      setDescription("");
      setMerchant("");
      // Current local ISO string for datetime-local
      const now = new Date();
      const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setOccurredAt(localIso);
      setStatus("posted");
      setNotes("");
      setCorrectionReason("");
    }
    setErrorMessage(null);
  }, [editingTransaction, isOpen, defaultAccountId, defaultTripId, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!description.trim()) {
      setErrorMessage("Please enter a description or merchant name.");
      return;
    }

    if (!accountId) {
      setErrorMessage("Please select an account.");
      return;
    }

    let paise = 0;
    try {
      paise = rupeesToPaise(amountStr);
      if (paise <= 0) {
        setErrorMessage("Amount must be greater than zero.");
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid amount";
      setErrorMessage(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTransaction) {
        await transactionService.correctTransaction(
          editingTransaction.id,
          {
            tripAssignment:tripChoice==="__auto"?{mode:"auto"}:tripChoice==="__normal"||direction==="inflow"?{mode:"excluded"}:{mode:"manual",tripId:tripChoice},
            description: description.trim(),
            merchant: merchant.trim() || undefined,
            amountPaise: paise,
            direction,
            categoryId: categoryId || undefined,
            status,
            notes: notes.trim() || undefined,
            occurredAt: new Date(occurredAt).toISOString(),
            pocketId: direction === "outflow" ? (pocketId || undefined) : undefined,
          },
          correctionReason.trim() || "User manual correction"
        );
      } else {
        await transactionService.recordTransaction({
          accountId,
          tripAssignment:tripChoice==="__auto"?{mode:"auto"}:tripChoice==="__normal"||direction==="inflow"?{mode:"excluded"}:{mode:"manual",tripId:tripChoice},
          description: description.trim(),
          merchant: merchant.trim() || undefined,
          amountPaise: paise,
          direction,
          categoryId: categoryId || undefined,
          status,
          notes: notes.trim() || undefined,
          occurredAt: new Date(occurredAt).toISOString(),
          source: "manual",
          pocketId: direction === "outflow" ? (pocketId || undefined) : undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save transaction";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter categories matching the selected direction (or all)
  const availableCategories = categories.filter(
    (c) => c.type === (direction === "inflow" ? "income" : "expense")
  );

  const availablePockets = (pockets || []).filter(
    (p) => p.linkedAccountId === accountId && p.status !== "archived" && !p.isLegacyGoal
  );

  const tripDetail=direction==="outflow"&&tripChoice!=="__normal"&&(tripChoice!=="__auto"||!!editingTransaction?.tripAssignment?.tripId);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingTransaction ? "Edit Transaction" : "Record Transaction"}
      subtitle={editingTransaction ? "Modifications are preserved with an immutable audit log." : undefined}
      maxWidthClassName="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Direction Switcher (Expense vs Income) */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-surface rounded-xl border border-muted">
          <button
            type="button"
            onClick={() => setDirection("outflow")}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              direction === "outflow"
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
            <span>Expense (Outflow)</span>
          </button>

          <button
            type="button"
            onClick={() => setDirection("inflow")}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              direction === "inflow"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            <span>Income (Inflow)</span>
          </button>
        </div>

        {/* Amount Input */}
        <div className="space-y-1">
          <label className="text-xs font-sans font-medium text-muted-foreground">Amount (₹ INR)</label>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-sm font-mono text-muted-foreground">₹</span>
            <input
              type="text"
              required
              autoFocus={!editingTransaction}
              placeholder="0.00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-surface border border-muted text-base font-mono font-semibold text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Account and Category Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-sans font-medium text-muted-foreground">Account</label>
            <FinanceSelect
              value={accountId}
              disabled={!!editingTransaction}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500 disabled:opacity-60"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.accountType})
                </option>
              ))}
            </FinanceSelect>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-medium text-muted-foreground">{tripDetail?"Trip detail category":"Category"}</label>
            <FinanceSelect
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
            >
              <option value="">Uncategorized</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FinanceSelect>
            {tripDetail&&<p>Finance category: Travel &amp; Leisure. This detail is kept for the trip breakdown.</p>}
          </div>
        </div>

        {/* Savings Pocket Selector (for expense/outflow only) */}
        {direction === "outflow" && availablePockets.length > 0 && (
          <div className="space-y-1">
            <label className="text-xs font-sans font-medium text-muted-foreground flex items-center justify-between">
              <span>Spend from Savings Pocket (Optional)</span>
              <span className="text-[10px] text-emerald-400 font-mono">Deducts from pocket allocation</span>
            </label>
            <FinanceSelect
              aria-label="Spend from savings pocket"
              value={pocketId}
              onChange={(e) => setPocketId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
            >
              <option value="">None (Spend from general unallocated funds)</option>
              {availablePockets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · ₹{((p.allocatedPaise || 0) / 100).toFixed(2)} allocated
                </option>
              ))}
            </FinanceSelect>
            <p className="text-[11px] text-muted-foreground">
              Money stays in your account. The pocket allocation will reduce by the expense amount.
            </p>
          </div>
        )}

        {/* Description & Merchant */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-sans font-medium text-muted-foreground">Description</label>
            <input
              type="text"
              required
              placeholder="e.g. Groceries at Zepto, Train Ticket"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-medium text-muted-foreground">Merchant / Payee (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Starbucks, Uber"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Date and Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-sans font-medium text-muted-foreground">Date & Time</label>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-sans font-medium text-muted-foreground">Settlement Status</label>
            <FinanceSelect
              value={status}
              onChange={(e) => setStatus(e.target.value as TransactionStatus)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
            >
              <option value="posted">Posted (Cleared)</option>
              <option value="pending">Pending (Authorized)</option>
            </FinanceSelect>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-xs font-sans font-medium text-muted-foreground">Notes (Optional)</label>
          <input
            type="text"
            placeholder="Add extra memo or trip tags..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Correction Reason (only on edit) */}
        {editingTransaction && (
          <div className="space-y-1 pt-1">
            <label className="text-xs font-sans font-medium text-amber-400">
              Correction Reason (Audit Trail)
            </label>
            <input
              type="text"
              placeholder="e.g. Corrected amount from paper receipt"
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-amber-500/40 text-xs text-foreground focus:outline-none focus:border-amber-400"
            />
          </div>
        )}

        {direction==="outflow"&&<div><label>Trip assignment</label><FinanceSelect aria-label="Trip assignment" value={tripChoice} onChange={e=>setTripChoice(e.target.value)}><option value="__auto">Automatic · confirmed trip window</option><option value="__normal">Normal category · keep outside trips</option>{tripOptions.map(trip=><option key={trip.id} value={trip.id}>{trip.title} · manual / advance booking</option>)}</FinanceSelect><p>Manual choices stay attached even outside the travel dates.</p></div>}
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
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer ${
              direction === "inflow"
                ? "bg-emerald-500 text-black hover:bg-emerald-400"
                : "bg-rose-500 text-white hover:bg-rose-400"
            }`}
          >
            {editingTransaction ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{editingTransaction ? "Save Correction" : "Record Transaction"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

