"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Repeat,
  Check,
  Pause,
  Play,
  Trash2,
  Calendar,
  Sparkles,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import {
  RecurringRule,
  RecurringService,
  formatPaise,
  FinanceCategory,
  FinanceAccount,
} from "@/lib/finance";

interface RecurringPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurringService: RecurringService;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
}

export default function RecurringPaymentsModal({
  isOpen,
  onClose,
  recurringService,
  accounts,
  categories,
}: RecurringPaymentsModalProps) {
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "DETECTED">("ACTIVE");
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const accountMap = React.useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryMap = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const allRules = await recurringService.getRecurringRules();
      setRules(allRules);
    } catch (err: unknown) {
      console.error("Failed to load recurring rules", err);
    } finally {
      setLoading(false);
    }
  }, [recurringService]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setStatusMessage(null);
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const activeRules = rules.filter((r) => r.status === "confirmed" || r.status === "paused");
  const detectedRules = rules.filter((r) => r.status === "detected");

  const handleScanHistory = async () => {
    setLoading(true);
    try {
      const detected = await recurringService.detectRecurringPatterns();
      await loadData();
      if (detected.length > 0) {
        setStatusMessage(`Pattern scan complete: Found ${detected.length} potential recurring payments!`);
        setActiveTab("DETECTED");
      } else {
        setStatusMessage("No new recurring patterns discovered in transaction history.");
      }
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (ruleId: string) => {
    try {
      await recurringService.confirmRecurringRule(ruleId);
      await loadData();
      setStatusMessage("Recurring subscription confirmed!");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleDismiss = async (ruleId: string) => {
    try {
      await recurringService.dismissRecurringRule(ruleId);
      await loadData();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleTogglePause = async (rule: RecurringRule) => {
    try {
      if (rule.status === "paused") {
        await recurringService.resumeRecurringRule(rule.id);
      } else {
        await recurringService.pauseRecurringRule(rule.id);
      }
      await loadData();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Subscriptions & Recurring Bills</h2>
              <p className="text-xs text-muted-foreground">Deterministic local pattern detection and forecasting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 pt-2">
          <div className="flex">
            <button
              onClick={() => setActiveTab("ACTIVE")}
              className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === "ACTIVE"
                  ? "border-purple-500 text-purple-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Confirmed Bills</span>
              {activeRules.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-500/10 text-purple-400 font-bold">
                  {activeRules.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("DETECTED")}
              className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                activeTab === "DETECTED"
                  ? "border-purple-500 text-purple-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Detected Recommendations</span>
              {detectedRules.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-500 font-bold">
                  {detectedRules.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={handleScanHistory}
            disabled={loading}
            className="mb-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Scan History</span>
          </button>
        </div>

        {/* Notification Toast */}
        {statusMessage && (
          <div className="mx-6 mt-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Disclaimers & Info */}
        <div className="mx-6 mt-3 px-3 py-2 bg-muted/30 border border-border/60 rounded-xl flex items-start gap-2.5 text-[11px] text-muted-foreground">
          <HelpCircle className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5" />
          <span>
            Predictions and estimated dates are calculated deterministically from local history. Future bills are marked
            as estimates and <strong>never inject unconfirmed transactions</strong> into your ledger.
          </span>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {activeTab === "ACTIVE" && (
            <div>
              {activeRules.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <Repeat className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">No Confirmed Subscriptions</p>
                  <p className="text-xs">
                    Run &quot;Scan History&quot; to discover recurring patterns, rent payments, or utility bills from your records.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeRules.map((rule) => {
                    const acc = accountMap.get(rule.accountId);
                    const cat = rule.categoryId ? categoryMap.get(rule.categoryId) : null;
                    const isPaused = rule.status === "paused";

                    return (
                      <div
                        key={rule.id}
                        className={`p-4 border rounded-xl space-y-2 transition-all ${
                          isPaused
                            ? "bg-muted/10 border-border/40 opacity-70"
                            : "bg-card border-border hover:border-border/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground">
                                {rule.merchant || rule.description}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-500/10 text-purple-400 capitalize">
                                {rule.frequency}
                              </span>
                              {isPaused && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-500">
                                  Paused
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {acc?.name || "Account"} {cat ? `• ${cat.name}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-sm text-foreground">
                              {formatPaise(rule.amountPaise)}
                            </span>
                            {rule.expectedMinAmountPaise &&
                              rule.expectedMaxAmountPaise &&
                              rule.expectedMinAmountPaise !== rule.expectedMaxAmountPaise && (
                                <p className="text-[10px] text-muted-foreground">
                                  Est: {formatPaise(rule.expectedMinAmountPaise)} -{" "}
                                  {formatPaise(rule.expectedMaxAmountPaise)}
                                </p>
                              )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            Next estimated:{" "}
                            <span className="text-foreground font-medium">
                              {rule.nextDueDate.split("T")[0]}
                            </span>
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleTogglePause(rule)}
                              className="px-2 py-1 rounded-md text-xs font-medium border border-border hover:border-foreground/30 text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                            >
                              {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                              <span>{isPaused ? "Resume" : "Pause"}</span>
                            </button>
                            <button
                              onClick={() => handleDismiss(rule.id)}
                              className="p-1 text-muted-foreground hover:text-rose-400 cursor-pointer"
                              title="Dismiss / Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "DETECTED" && (
            <div>
              {detectedRules.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/60" />
                  <p className="text-sm font-medium text-foreground">No Pending Recommendations</p>
                  <p className="text-xs">
                    All detected recurring patterns have been reviewed. Click &quot;Scan History&quot; to re-analyze.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {detectedRules.map((rule) => {
                    const acc = accountMap.get(rule.accountId);
                    const cat = rule.categoryId ? categoryMap.get(rule.categoryId) : null;

                    return (
                      <div
                        key={rule.id}
                        className="p-4 bg-muted/20 border border-amber-500/30 rounded-xl space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground">
                                {rule.merchant || rule.description}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-500 capitalize">
                                {rule.frequency}
                              </span>
                              {rule.confidenceScore && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {Math.round(rule.confidenceScore * 100)}% confidence
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {acc?.name || "Account"} {cat ? `• ${cat.name}` : ""}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-sm text-foreground">
                            {formatPaise(rule.amountPaise)}
                          </span>
                        </div>

                        {rule.explanation && (
                          <p className="text-[11px] text-amber-400/90 bg-amber-500/5 px-2.5 py-1 rounded-md border border-amber-500/10">
                            {rule.explanation}
                          </p>
                        )}

                        <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">
                            Next Est: {rule.nextDueDate.split("T")[0]}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleConfirm(rule.id)}
                              className="px-3 py-1 text-xs rounded-md bg-purple-500 text-white font-semibold hover:bg-purple-600 flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>Confirm Bill</span>
                            </button>
                            <button
                              onClick={() => handleDismiss(rule.id)}
                              className="px-2.5 py-1 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

