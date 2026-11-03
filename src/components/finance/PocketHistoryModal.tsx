"use client";

import React from "react";
import { Modal } from "./FinanceDialog";
import {
  SavingsPocket,
  PocketHistoryEntry,
  formatPaise,
} from "@/lib/finance";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  Sparkles,
  ShoppingBag,
  RotateCcw,
  Calendar,
  Clock,
  PiggyBank,
} from "lucide-react";

interface PocketHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  pocket: SavingsPocket | null;
}

export default function PocketHistoryModal({
  isOpen,
  onClose,
  pocket,
}: PocketHistoryModalProps) {
  if (!pocket) return null;

  const history = [...(pocket.history || [])].sort(
    (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)
  );

  const getEventBadge = (entry: PocketHistoryEntry) => {
    switch (entry.type) {
      case "allocate":
        return {
          label: "Set aside",
          icon: ArrowDownRight,
          colorClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          prefix: "+",
        };
      case "release":
        return {
          label: "Released to account",
          icon: ArrowUpRight,
          colorClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
          prefix: "−",
        };
      case "move_in":
        return {
          label: `Received from ${entry.relatedPocketName || "pocket"}`,
          icon: ArrowRightLeft,
          colorClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
          prefix: "+",
        };
      case "move_out":
        return {
          label: `Moved to ${entry.relatedPocketName || "pocket"}`,
          icon: ArrowRightLeft,
          colorClass: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
          prefix: "−",
        };
      case "spend":
        return {
          label: "Spent on payment",
          icon: ShoppingBag,
          colorClass: "bg-rose-500/15 text-rose-400 border-rose-500/30",
          prefix: "−",
        };
      case "refund":
        return {
          label: "Restored from cancelled payment",
          icon: RotateCcw,
          colorClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          prefix: "+",
        };
      case "legacy_import":
        return {
          label: "Initial migration",
          icon: Sparkles,
          colorClass: "bg-teal-500/15 text-teal-400 border-teal-500/30",
          prefix: "+",
        };
      default:
        return {
          label: "Allocation change",
          icon: PiggyBank,
          colorClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
          prefix: "",
        };
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${pocket.name} · History`}
      subtitle={`Currently set aside: ${formatPaise(pocket.allocatedPaise || 0)}`}
      maxWidthClassName="max-w-md"
    >
      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground space-y-2">
            <Clock size={32} className="mx-auto opacity-40" />
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs opacity-75">
              Amounts you set aside, release, or spend will be catalogued here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {history.map((entry) => {
              const badge = getEventBadge(entry);
              const Icon = badge.icon;
              return (
                <div
                  key={entry.id}
                  className="p-3.5 rounded-xl bg-surface/70 border border-muted/70 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${badge.colorClass}`}
                      >
                        <Icon size={12} />
                        <span>{badge.label}</span>
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(entry.occurredAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {entry.note && (
                      <p className="text-xs text-foreground/90 font-medium break-words">
                        {entry.note}
                      </p>
                    )}

                    <p className="text-[11px] text-muted-foreground">
                      Balance after:{" "}
                      <span className="font-semibold text-foreground/80">
                        {formatPaise(entry.balanceAfterPaise)}
                      </span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-semibold tracking-tight ${
                        badge.prefix === "+" ? "text-emerald-400" : "text-foreground"
                      }`}
                    >
                      {badge.prefix}
                      {formatPaise(entry.amountPaise)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2 border-t border-muted/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-hover border border-muted text-foreground transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
