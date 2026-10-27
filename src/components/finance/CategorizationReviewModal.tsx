"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Sparkles,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Tag,
  ToggleLeft,
  ToggleRight,
  Filter,
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

  // New Rule Form State
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleMatchType, setNewRuleMatchType] = useState<RuleMatchType>("contains");
  const [newRuleCategoryId, setNewRuleCategoryId] = useState<string>(categories[0]?.id || "");
  const [newRuleDirection, setNewRuleDirection] = useState<"inflow" | "outflow" | "all">("all");

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
    if (isOpen) {
      loadData();
      setIsAddingRule(false);
      setStatusMessage(null);
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const handleAcceptSuggestion = async (txn: Transaction, sugg: CategorizationResult) => {
    try {
      await categorizationService.learnUserCorrection(txn, sugg.categoryId);
      // Re-query to update list
      await loadData();
      onTransactionsUpdated();
      setStatusMessage(`Categorized "${txn.description}" as ${sugg.categoryName}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleManualAssign = async (txn: Transaction, categoryId: string, createRule: boolean) => {
    if (!categoryId) return;
    try {
      if (createRule) {
        await categorizationService.learnUserCorrection(txn, categoryId);
      } else {
        const uow = (categorizationService as any).uow;
        const updated: Transaction = {
          ...txn,
          categoryId,
          reviewRequired: false,
          updatedAt: new Date().toISOString(),
          version: txn.version + 1,
        };
        await uow.transactions.save(updated);
      }
      await loadData();
      onTransactionsUpdated();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Smart Categorization & Rules</h2>
              <p className="text-xs text-muted-foreground">Deterministic local classification without cloud scraping</p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "REVIEW" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground">
                  Transactions without categories or flagged for user review. Suggestions are based on local merchant rules.
                </p>
                {uncategorized.length > 0 && (
                  <button
                    onClick={handleBatchApplyRules}
                    disabled={loading}
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

                        {/* Suggestion Card or Manual Selector */}
                        <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
                          {sugg ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-amber-400 flex items-center gap-1 font-medium bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                                <Sparkles className="w-3 h-3" />
                                {sugg.categoryName} ({Math.round(sugg.confidence * 100)}% match)
                              </span>
                              <button
                                onClick={() => handleAcceptSuggestion(txn, sugg)}
                                className="px-2.5 py-1 text-xs rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                Accept
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              No automatic rule matched
                            </span>
                          )}

                          {/* Quick Category Picker */}
                          <div className="flex items-center gap-1.5">
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                const selectedCat = e.target.value;
                                if (!selectedCat) return;
                                const remember = confirm(`Remember this category for future transactions matching "${txn.merchant || txn.description}"?`);
                                handleManualAssign(txn, selectedCat, remember);
                              }}
                              className="px-2 py-1 text-xs bg-background border border-border rounded-md text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              <option value="" disabled>
                                Choose category...
                              </option>
                              {categories
                                .filter((c) =>
                                  txn.direction === "inflow" ? c.type === "income" : c.type === "expense"
                                )
                                .map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </option>
                                ))}
                            </select>
                          </div>
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
                      <select
                        value={newRuleCategoryId}
                        onChange={(e) => setNewRuleCategoryId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.type})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Match Type</label>
                      <select
                        value={newRuleMatchType}
                        onChange={(e) => setNewRuleMatchType(e.target.value as RuleMatchType)}
                        className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="contains">Contains Keyword</option>
                        <option value="exact">Exact Merchant Match</option>
                        <option value="starts_with">Starts With</option>
                        <option value="regex">Regular Expression</option>
                      </select>
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

