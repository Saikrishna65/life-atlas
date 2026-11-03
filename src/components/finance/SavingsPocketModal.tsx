"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "./FinanceDialog";
import FinanceSelect from "@/components/finance/FinanceSelect";
import {
  SavingsPocket,
  SavingsGoalService,
  FinanceAccount,
  rupeesToPaise,
  paiseToDecimalString,
  formatPaise,
  ID,
} from "@/lib/finance";
import {
  Plus,
  Check,
  Target,
  PiggyBank,
  Calendar,
  ArrowRightLeft,
  ArrowDownRight,
  ArrowUpRight,
  Trash2,
  Archive,
  Info,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";

export type PocketModalMode =
  | "create"
  | "edit"
  | "allocate"
  | "release"
  | "move"
  | "migrate_legacy";

interface SavingsPocketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  savingsGoalService: SavingsGoalService;
  accounts: FinanceAccount[];
  allPockets: SavingsPocket[];
  editingPocket?: SavingsPocket | null;
  mode?: PocketModalMode;
  initialAccountId?: string;
}

const POCKET_COLORS = [
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#14B8A6", // Teal
  "#F97316", // Orange
];

const POCKET_ICONS = [
  { id: "PiggyBank", label: "Piggy Bank" },
  { id: "Target", label: "Target" },
  { id: "Umbrella", label: "Rainy Day" },
  { id: "Compass", label: "Travel" },
  { id: "Laptop", label: "Tech" },
  { id: "Home", label: "Home" },
  { id: "Car", label: "Vehicle" },
  { id: "Gift", label: "Gift" },
];

export default function SavingsPocketModal({
  isOpen,
  onClose,
  onSuccess,
  savingsGoalService,
  accounts,
  allPockets,
  editingPocket,
  mode = "create",
  initialAccountId,
}: SavingsPocketModalProps) {
  const activeAssetAccounts = accounts.filter(
    (a) => a.status === "active" && (a.accountType === "bank" || a.accountType === "cash" || a.accountType === "savings")
  );

  const [name, setName] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [targetAmountStr, setTargetAmountStr] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [targetPocketId, setTargetPocketId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [color, setColor] = useState("#10B981");
  const [icon, setIcon] = useState("PiggyBank");
  const [note, setNote] = useState("");
  const [availableToSpend, setAvailableToSpend] = useState<number | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load account summary when account changes in create, allocate or migrate mode
  useEffect(() => {
    let alive = true;
    const accId =
      mode === "create" || mode === "migrate_legacy"
        ? selectedAccountId
        : editingPocket?.linkedAccountId;

    if (accId) {
      savingsGoalService
        .getAccountPocketSummary(accId)
        .then((s) => {
          if (alive) setAvailableToSpend(s.availableBalancePaise);
        })
        .catch(() => {
          if (alive) setAvailableToSpend(null);
        });
    } else {
      setAvailableToSpend(null);
    }

    return () => {
      alive = false;
    };
  }, [selectedAccountId, editingPocket, mode, savingsGoalService]);

  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setNote("");
    setAmountStr("");

    if (editingPocket) {
      setName(editingPocket.name);
      setSelectedAccountId(editingPocket.linkedAccountId || initialAccountId || activeAssetAccounts[0]?.id || "");
      setTargetAmountStr(
        editingPocket.targetAmountPaise ? paiseToDecimalString(editingPocket.targetAmountPaise) : ""
      );
      setTargetDate(editingPocket.targetDate ? editingPocket.targetDate.split("T")[0] : "");
      setColor(editingPocket.color || "#10B981");
      setIcon(editingPocket.icon || "PiggyBank");

      if (mode === "move") {
        // Find other pockets on the exact same account
        const peers = allPockets.filter(
          (p) => p.id !== editingPocket.id && p.linkedAccountId === editingPocket.linkedAccountId && p.status !== "archived"
        );
        setTargetPocketId(peers[0]?.id || "");
      } else if (mode === "migrate_legacy") {
        setAmountStr(
          editingPocket.legacyTrackedPaise ? paiseToDecimalString(editingPocket.legacyTrackedPaise) : ""
        );
      }
    } else {
      setName("");
      setSelectedAccountId(initialAccountId || activeAssetAccounts[0]?.id || "");
      setTargetAmountStr("");
      setTargetDate("");
      setColor("#10B981");
      setIcon("PiggyBank");
    }
  }, [editingPocket, isOpen, mode, initialAccountId, accounts, allPockets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        if (!name.trim()) {
          throw new Error("Please enter a pocket name.");
        }
        if (!selectedAccountId) {
          throw new Error("Please choose an account to link this pocket.");
        }

        const targetPaise = targetAmountStr.trim() ? rupeesToPaise(targetAmountStr) : undefined;
        const initialAllocation = amountStr.trim() ? rupeesToPaise(amountStr) : 0;

        await savingsGoalService.createPocket({
          name: name.trim(),
          linkedAccountId: selectedAccountId,
          targetAmountPaise: targetPaise,
          initialAllocationPaise: initialAllocation,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
          color,
          icon,
          note: note.trim() || undefined,
        });
      } else if (mode === "edit" && editingPocket) {
        if (!name.trim()) {
          throw new Error("Please enter a pocket name.");
        }

        const targetPaise = targetAmountStr.trim() ? rupeesToPaise(targetAmountStr) : null;

        await savingsGoalService.updatePocket(editingPocket.id, {
          name: name.trim(),
          targetAmountPaise: targetPaise,
          targetDate: targetDate ? new Date(targetDate).toISOString() : null,
          color,
          icon,
        });
      } else if (mode === "allocate" && editingPocket) {
        const paise = rupeesToPaise(amountStr);
        if (paise <= 0) {
          throw new Error("Enter an amount greater than zero to set aside.");
        }
        await savingsGoalService.allocateToPocket(editingPocket.id, paise, note.trim() || undefined);
      } else if (mode === "release" && editingPocket) {
        const paise = rupeesToPaise(amountStr);
        if (paise <= 0) {
          throw new Error("Enter an amount greater than zero to release.");
        }
        await savingsGoalService.releaseFromPocket(editingPocket.id, paise, note.trim() || undefined);
      } else if (mode === "move" && editingPocket) {
        if (!targetPocketId) {
          throw new Error("Choose another pocket on this account to move funds to.");
        }
        const paise = rupeesToPaise(amountStr);
        if (paise <= 0) {
          throw new Error("Enter an amount greater than zero to move.");
        }
        await savingsGoalService.moveAllocation(
          editingPocket.id,
          targetPocketId,
          paise,
          note.trim() || undefined
        );
      } else if (mode === "migrate_legacy" && editingPocket) {
        if (!selectedAccountId) {
          throw new Error("Please select an active account.");
        }
        const paise = amountStr.trim() ? rupeesToPaise(amountStr) : 0;
        await savingsGoalService.migrateLegacyGoal(
          editingPocket.id,
          selectedAccountId,
          paise,
          note.trim() || undefined
        );
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process request";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingPocket) return;
    if ((editingPocket.allocatedPaise || 0) > 0) {
      setErrorMessage(
        `Cannot delete: release or reallocate the remaining ${formatPaise(editingPocket.allocatedPaise || 0)} first.`
      );
      return;
    }

    if (!confirm(`Delete pocket "${editingPocket.name}"? This cannot be undone.`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await savingsGoalService.deletePocket(editingPocket.id);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete pocket");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!editingPocket) return;
    setIsSubmitting(true);
    try {
      if (editingPocket.status === "archived") {
        await savingsGoalService.unarchivePocket(editingPocket.id);
      } else {
        await savingsGoalService.archivePocket(editingPocket.id);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to change archive status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitleAndSubtitle = () => {
    switch (mode) {
      case "create":
        return {
          title: "New Savings Pocket",
          subtitle: "Set aside money within your existing bank or cash accounts.",
        };
      case "edit":
        return {
          title: `Edit ${editingPocket?.name || "Pocket"}`,
          subtitle: "Update pocket details, goals, or archive status.",
        };
      case "allocate":
        return {
          title: `Set aside into ${editingPocket?.name || "Pocket"}`,
          subtitle:
            availableToSpend !== null
              ? `Available in account: ${formatPaise(availableToSpend)}`
              : "Earmark money from your account balance.",
        };
      case "release":
        return {
          title: `Release from ${editingPocket?.name || "Pocket"}`,
          subtitle: `Currently set aside: ${formatPaise(editingPocket?.allocatedPaise || 0)}`,
        };
      case "move":
        return {
          title: `Move allocation from ${editingPocket?.name || "Pocket"}`,
          subtitle: `Currently set aside: ${formatPaise(editingPocket?.allocatedPaise || 0)}`,
        };
      case "migrate_legacy":
        return {
          title: `Set up allocation for ${editingPocket?.name || "Goal"}`,
          subtitle: `Legacy progress: ${formatPaise(editingPocket?.legacyTrackedPaise || 0)} (not reserved from any account)`,
        };
    }
  };

  const { title, subtitle } = getTitleAndSubtitle();

  // Find peer pockets for the move mode
  const eligibleTargetPockets =
    mode === "move" && editingPocket
      ? allPockets.filter(
          (p) =>
            p.id !== editingPocket.id &&
            p.linkedAccountId === editingPocket.linkedAccountId &&
            p.status !== "archived"
        )
      : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      maxWidthClassName="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs leading-relaxed">
            {errorMessage}
          </div>
        )}

        {/* Explainability note */}
        <div className="p-3 rounded-xl bg-surface/60 border border-muted/60 text-xs text-muted-foreground flex items-start gap-2.5">
          <Info size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Money stays in your account. Atlas tracks what you’ve set aside. Pocket allocations never change your bank balance or net worth.
          </p>
        </div>

        {/* CREATE / EDIT: Name & Linked Account */}
        {(mode === "create" || mode === "edit") && (
          <>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Pocket Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Vacation, Bike Insurance, Rainy Day"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-muted text-foreground text-sm focus:outline-hidden focus:border-foreground/40 transition-colors"
              />
            </div>

            {mode === "create" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Linked Finance Account
                </label>
                <FinanceSelect
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full"
                >
                  <option value="" disabled>
                    Select an account
                  </option>
                  {activeAssetAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.accountType}) · Recorded {formatPaise(a.currentBalancePaise)}
                    </option>
                  ))}
                </FinanceSelect>
                {availableToSpend !== null && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Available to allocate in this account:{" "}
                    <span className="font-semibold text-foreground/80">
                      {formatPaise(availableToSpend)}
                    </span>
                  </p>
                )}
              </div>
            )}

            {mode === "create" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Initial Set-aside (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-surface border border-muted text-foreground text-sm focus:outline-hidden focus:border-foreground/40 transition-colors font-mono"
                  />
                </div>
              </div>
            )}

            {/* Target Amount & Target Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Target (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-semibold">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="None"
                    value={targetAmountStr}
                    onChange={(e) => setTargetAmountStr(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-xl bg-surface border border-muted text-foreground text-xs focus:outline-hidden focus:border-foreground/40 transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Target Date (Optional)
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-muted text-foreground text-xs focus:outline-hidden focus:border-foreground/40 transition-colors"
                />
              </div>
            </div>

            {/* Color Swatches */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Color
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {POCKET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border transition-all cursor-pointer ${
                      color === c ? "ring-2 ring-foreground ring-offset-2 scale-110" : "opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c, borderColor: "#ffffff40" }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ALLOCATE ("Set aside") */}
        {mode === "allocate" && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Amount to Set Aside
                </label>
                {availableToSpend !== null && (
                  <span className="text-[11px] text-muted-foreground">
                    Available: <b className="text-foreground/90">{formatPaise(availableToSpend)}</b>
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-surface border border-muted text-foreground text-sm focus:outline-hidden focus:border-foreground/40 transition-colors font-mono"
                />
              </div>

              {/* Quick Chip Allocations */}
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                {[50, 100, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountStr(String(amt))}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface hover:bg-surface-hover border border-muted text-foreground/80 cursor-pointer transition-colors"
                  >
                    +₹{amt}
                  </button>
                ))}
                {availableToSpend !== null && availableToSpend > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmountStr(paiseToDecimalString(availableToSpend))}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer transition-colors ml-auto"
                  >
                    All available
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Leftover cash, Weekend savings"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-surface border border-muted text-foreground text-xs focus:outline-hidden focus:border-foreground/40 transition-colors"
              />
            </div>
          </>
        )}

        {/* RELEASE */}
        {mode === "release" && editingPocket && (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Amount to Release Back
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Set aside: <b className="text-foreground/90">{formatPaise(editingPocket.allocatedPaise || 0)}</b>
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={paiseToDecimalString(editingPocket.allocatedPaise || 0)}
                  required
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-surface border border-muted text-foreground text-sm focus:outline-hidden focus:border-foreground/40 transition-colors font-mono"
                />
              </div>

              {/* Quick Release Chips */}
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                {[100, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={amt * 100 > (editingPocket.allocatedPaise || 0)}
                    onClick={() => setAmountStr(String(amt))}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface hover:bg-surface-hover border border-muted text-foreground/80 cursor-pointer transition-colors disabled:opacity-40"
                  >
                    Release ₹{amt}
                  </button>
                ))}
                {(editingPocket.allocatedPaise || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setAmountStr(paiseToDecimalString(editingPocket.allocatedPaise || 0))
                    }
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 cursor-pointer transition-colors ml-auto"
                  >
                    Release all
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Needed for urgent expense"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-surface border border-muted text-foreground text-xs focus:outline-hidden focus:border-foreground/40 transition-colors"
              />
            </div>
          </>
        )}

        {/* MOVE ALLOCATION */}
        {mode === "move" && editingPocket && (
          <>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Destination Pocket (Same Account)
              </label>
              {eligibleTargetPockets.length === 0 ? (
                <div className="p-3 rounded-xl bg-surface border border-muted text-xs text-muted-foreground">
                  No other pockets are linked to this account. You can create another pocket linked to this account first.
                </div>
              ) : (
                <FinanceSelect
                  value={targetPocketId}
                  onChange={(e) => setTargetPocketId(e.target.value)}
                  className="w-full"
                >
                  <option value="" disabled>
                    Choose destination pocket
                  </option>
                  {eligibleTargetPockets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · Currently has {formatPaise(p.allocatedPaise || 0)}
                    </option>
                  ))}
                </FinanceSelect>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Amount to Move
                </label>
                <span className="text-[11px] text-muted-foreground">
                  Available in {editingPocket.name}:{" "}
                  <b className="text-foreground/90">{formatPaise(editingPocket.allocatedPaise || 0)}</b>
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={paiseToDecimalString(editingPocket.allocatedPaise || 0)}
                  required
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-surface border border-muted text-foreground text-sm focus:outline-hidden focus:border-foreground/40 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Reallocated toward upcoming goal"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-surface border border-muted text-foreground text-xs focus:outline-hidden focus:border-foreground/40 transition-colors"
              />
            </div>
          </>
        )}

        {/* MIGRATE LEGACY GOAL */}
        {mode === "migrate_legacy" && editingPocket && (
          <>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
              <strong>Legacy Tracked Goal:</strong>
              <p>
                This goal had {formatPaise(editingPocket.legacyTrackedPaise || 0)} recorded as a visual target, but was not reserved from any real account. Choose an account below to allocate real money to it.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Choose Account to Link
              </label>
              <FinanceSelect
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full"
              >
                <option value="" disabled>
                  Select an account
                </option>
                {activeAssetAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.accountType}) · Recorded {formatPaise(a.currentBalancePaise)}
                  </option>
                ))}
              </FinanceSelect>
              {availableToSpend !== null && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Available in account:{" "}
                  <span className="font-semibold text-foreground/80">
                    {formatPaise(availableToSpend)}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Confirmed Allocation Amount
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-surface border border-muted text-foreground text-sm focus:outline-hidden focus:border-foreground/40 transition-colors font-mono"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                You can set aside ₹0 for now, or allocate up to the account’s available balance.
              </p>
            </div>
          </>
        )}

        {/* Actions Bar */}
        <div className="pt-3 border-t border-muted/50 flex items-center justify-between gap-3">
          {mode === "edit" && editingPocket ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>

              <button
                type="button"
                onClick={handleToggleArchive}
                disabled={isSubmitting}
                className="px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-surface border border-transparent hover:border-muted transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Archive size={14} />
                <span>{editingPocket.status === "archived" ? "Unarchive" : "Archive"}</span>
              </button>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-surface border border-transparent transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || (mode === "move" && eligibleTargetPockets.length === 0)}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white shadow-soft transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting
                ? "Saving…"
                : mode === "create"
                ? "Create Pocket"
                : mode === "allocate"
                ? "Set Aside"
                : mode === "release"
                ? "Release Funds"
                : mode === "move"
                ? "Move Allocation"
                : mode === "migrate_legacy"
                ? "Confirm Allocation"
                : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
