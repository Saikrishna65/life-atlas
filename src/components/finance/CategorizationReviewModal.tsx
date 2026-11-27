"use client";
import SplitWith from "./shared/SplitWith";
import type { TransactionSplit } from "@/lib/finance/shared/transactionSplit";
import { FinancePanelHeader, useFinanceDialog } from "./FinanceDialog";

import FinanceSelect from "@/components/finance/FinanceSelect";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
} from "lucide-react";
import {
  Transaction,
  FinanceCategory,
  CategorizationRule,
  RuleMatchType,
  formatPaise,
  CategorizationService,
  CategorizationResult,
} from "@/lib/finance";

interface CategorizationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  categorizationService: CategorizationService;
  categories: FinanceCategory[];
  onTransactionsUpdated: () => void;
}

export default function CategorizationReviewModal({
  isOpen,
  onClose,
  categorizationService,
  categories,
  onTransactionsUpdated,
}: CategorizationReviewModalProps) {
  const [activeTab, setActiveTab] = useState<"REVIEW" | "RULES">("REVIEW");
  const [uncategorized, setUncategorized] = useState<Transaction[]>([]);
  const [suggestions, setSuggestions] = useState<Map<string, CategorizationResult | null>>(new Map());
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [splits, setSplits] = useState<Record<string, TransactionSplit | null>>({});
  const [chosenCategories, setChosenCategories] = useState<Record<string, string>>({});
  const [rememberCategories, setRememberCategories] = useState<Record<string, boolean>>({});
  const [busyPayment, setBusyPayment] = useState<string | null>(null);

  // New Rule Form State
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleMatchType, setNewRuleMatchType] = useState<RuleMatchType>("contains");
  const [newRuleCategoryId, setNewRuleCategoryId] = useState<string>(categories[0]?.id || "");
  const [newRuleDirection] = useState<"inflow" | "outflow" | "all">("all");

  const categoryMap = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [txns, allRules] = await Promise.all([
        categorizationService.getUncategorizedTransactions(),
        categorizationService.getAllRules(),
      ]);

      setUncategorized(txns);
      setRules(allRules);

      // Compute suggestions for uncategorized
      const suggMap = new Map<string, CategorizationResult | null>();
      for (const txn of txns) {
        const res = await categorizationService.suggestCategory(txn);
        suggMap.set(txn.id, res);
      }
      setSuggestions(suggMap);
    } catch (err: unknown) {
      console.error("Failed to load categorization data", err);
    } finally {
      setLoading(false);
    }
  }, [categorizationService]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => { void loadData(); setIsAddingRule(false); setStatusMessage(null); }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, loadData]);

  useFinanceDialog(isOpen, onClose);
  if (!isOpen) return null;

  const handleManualAssign = async (txn: Transaction, categoryId: string, remember: boolean) => {
    if (!categoryId || busyPayment) return;
    setBusyPayment(txn.id);
    try {
      const result = await categorizationService.reviewTransaction(txn, categoryId, splits[txn.id] === undefined ? txn.sharedSplit || null : splits[txn.id], remember);
      setChosenCategories(previous => { const next = {...previous}; delete next[txn.id]; return next; });
      setSplits(previous => { const next = {...previous}; delete next[txn.id]; return next; });
      await loadData(); onTransactionsUpdated();
      setStatusMessage(result.ruleSaved ? "Category and split saved." : "Payment saved. The category rule could not be remembered; you can add it later.");
    } catch (error) { alert(error instanceof Error ? error.message : "Could not save this review."); }
    finally { setBusyPayment(null); }
  };

  const handleToggleRule = async (ruleId: string, currentActive: boolean) => {
    try {
      await categorizationService.toggleRuleActive(ruleId, !currentActive);
      await loadData();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("Are you sure you want to delete this custom categorization rule?")) return;
    try {
      await categorizationService.deleteRule(ruleId);
      await loadData();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRulePattern.trim() || !newRuleCategoryId) {
      alert("Please fill all required rule fields");
      return;
    }

    try {
      await categorizationService.saveRule({
        name: newRuleName.trim(),
        pattern: newRulePattern.trim(),
        matchType: newRuleMatchType,
        categoryId: newRuleCategoryId,
        direction: newRuleDirection === "all" ? undefined : newRuleDirection,
        priority: 15,
        explanation: `Custom rule for ${newRuleName}`,
      });

      setIsAddingRule(false);
      setNewRuleName("");
      setNewRulePattern("");
      await loadData();
      setStatusMessage("New categorization rule saved successfully!");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleBatchApplyRules = async () => {
    setLoading(true);
    let totalApplied = 0;
    try {
      for (const rule of rules.filter((r) => r.isActive)) {
        const res = await categorizationService.applyRuleToUncategorized(rule.id);
        totalApplied += res.appliedCount;
      }
      await loadData();
      onTransactionsUpdated();
      setStatusMessage(`Batch categorization complete: ${totalApplied} transactions categorized!`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="finance-workspace-overlay">
      <div className="finance-workspace finance-tool-workspace" role="dialog" aria-modal="true" aria-label="Categories & rules" tabIndex={-1}>
        <FinancePanelHeader title="Categories & rules" subtitle="Organise uncategorised payments and personalise your rules." onClose={onClose}/>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-muted/20 px-6 pt-2">
          <button
            onClick={() => setActiveTab("REVIEW")}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "REVIEW"
                ? "border-amber-500 text-amber-500"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Review Uncategorized</span>
            {uncategorized.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-500 font-bold">
                {uncategorized.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("RULES")}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "RULES"
                ? "border-amber-500 text-amber-500"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Active Rules ({rules.length})</span>
          </button>
        </div>

        {/* Notification Toast */}
        {statusMessage && (
          <div className="mx-6 mt-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="finance-panel-content flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "REVIEW" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground">
                  Transactions without categories or flagged for user review. Suggestions are based on local merchant rules.
                </p>
                {uncategorized.length > 0 && (
                  <button
                    onClick={handleBatchApplyRules}
                    disabled={loading || busyPayment !== null || (Object.keys(splits).length > 0 || Object.keys(chosenCategories).length > 0)}
                    title={Object.keys(splits).length ? "Save your chosen splits individually first" : undefined}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Apply All Matches</span>
                  </button>
                )}
              </div>

              {uncategorized.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/60" />
                  <p className="text-sm font-medium text-foreground">All Transactions Categorized!</p>
                  <p className="text-xs">No pending transactions requiring review at this time.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {uncategorized.map((txn) => {
                    const sugg = suggestions.get(txn.id);
                    return (
                      <div
                        key={txn.id}
                        className="p-3.5 bg-muted/20 border border-border rounded-xl space-y-2 hover:border-border/80 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-foreground">
                                {txn.merchant || txn.description}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  txn.direction === "inflow"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-rose-500/10 text-rose-400"
                                }`}
                              >
                                {txn.direction === "inflow" ? "+ Income" : "- Expense"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {txn.occurredAt.split("T")[0]} {txn.merchant && txn.description !== txn.merchant ? `• ${txn.description}` : ""}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-sm text-foreground">
                            {formatPaise(txn.amountPaise)}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-border/50 space-y-3">
                          {sugg && <p className="text-xs text-muted-foreground">Suggested: {sugg.categoryName}</p>}
                          <label className="text-xs font-medium">Category<FinanceSelect aria-label={`Category for ${txn.description}`} disabled={busyPayment !== null} value={chosenCategories[txn.id] ?? sugg?.categoryId ?? txn.categoryId ?? ""} onChange={e => setChosenCategories(previous => ({...previous, [txn.id]:e.target.value}))}>
                            <option value="">Choose category...</option>
                            {categories.filter(c => txn.direction === "inflow" ? c.type === "income" : c.type === "expense").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </FinanceSelect></label>
                          <SplitWith value={splits[txn.id] === undefined ? txn.sharedSplit : splits[txn.id]} onChange={value => setSplits(previous => ({...previous, [txn.id]:value}))} amountPaise={txn.amountPaise} currency={txn.currency} eligible={txn.direction === "outflow" && !txn.transferGroupId && txn.paymentKind !== "transfer"} disabled={busyPayment !== null}/>
                          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!rememberCategories[txn.id]} disabled={busyPayment !== null} onChange={e => setRememberCategories(previous => ({...previous, [txn.id]:e.target.checked}))}/>Remember this category for the merchant</label>
                          <button type="button" className="af-primary" disabled={busyPayment !== null || !(chosenCategories[txn.id] ?? sugg?.categoryId ?? txn.categoryId)} onClick={() => handleManualAssign(txn, chosenCategories[txn.id] ?? sugg?.categoryId ?? txn.categoryId ?? "", !!rememberCategories[txn.id])}>{busyPayment === txn.id ? "Saving…" : "Save review"}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "RULES" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Rules are evaluated in priority order. User-created rules run before default system rules.
                </p>
                <button
                  onClick={() => setIsAddingRule(!isAddingRule)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-black hover:bg-amber-400 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingRule ? "Cancel" : "Add Custom Rule"}</span>
                </button>
              </div>

              {/* Add Custom Rule Form */}
              {isAddingRule && (
                <form
                  onSubmit={handleCreateRule}
                  className="p-4 bg-muted/30 border border-border rounded-xl space-y-3"
                >
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Create New Categorization Rule
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Rule Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Swiggy Orders"
                        value={newRuleName}
                        onChange={(e) => setNewRuleName(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Keyword / Pattern *</label>
                      <input
                        type="text"
                        placeholder="e.g. swiggy"
                        value={newRulePattern}
                        onChange={(e) => setNewRulePattern(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Target Category *</label>
                      <FinanceSelect
                        value={newRuleCategoryId}
                        onChange={(e) => setNewRuleCategoryId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.type})
                          </option>
                        ))}
                      </FinanceSelect>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Match Type</label>
                      <FinanceSelect
                        value={newRuleMatchType}
                        onChange={(e) => setNewRuleMatchType(e.target.value as RuleMatchType)}
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="contains">Contains Keyword</option>
                        <option value="exact">Exact Merchant Match</option>
                        <option value="starts_with">Starts With</option>
                        <option value="regex">Regular Expression</option>
                      </FinanceSelect>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-black hover:bg-amber-400 cursor-pointer"
                    >
                      Save Rule
                    </button>
                  </div>
                </form>
              )}

              {/* Rules List */}
              <div className="space-y-2">
                {rules.map((rule) => {
                  const targetCat = categoryMap.get(rule.categoryId);
                  return (
                    <div
                      key={rule.id}
                      className={`p-3 border rounded-xl flex items-center justify-between gap-3 ${
                        rule.isActive
                          ? "bg-card border-border"
                          : "bg-muted/10 border-border/40 opacity-60"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground">{rule.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                            {rule.matchType}: &quot;{rule.pattern}&quot;
                          </span>
                          {rule.isSystem && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/10 text-blue-400 font-medium">
                              System
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Categorizes to <span className="text-foreground font-medium">{targetCat?.name || rule.categoryId}</span>
                          {rule.direction ? ` (${rule.direction} only)` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleRule(rule.id, rule.isActive)}
                          className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                          title={rule.isActive ? "Deactivate rule" : "Activate rule"}
                        >
                          {rule.isActive ? (
                            <ToggleRight className="w-5 h-5 text-amber-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                        {!rule.isSystem && (
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="p-1 text-muted-foreground hover:text-rose-400 cursor-pointer"
                            title="Delete custom rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

