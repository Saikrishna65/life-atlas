"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  Wallet,
  Plus,
  Search,
  ArrowRightLeft,
  ArrowDownRight,
  ArrowUpRight,
  Landmark,
  CreditCard,
  CheckCircle2,
  Tag,
  Target,
  ChevronRight,
  Archive,
  Edit3,
  FileUp,
  Sparkles,
  Repeat,
  TrendingUp,
  Cloud,
  CloudOff,
  BellRing,
} from "lucide-react";
import {
  IndexedDBUnitOfWork,
  AccountService,
  TransactionService,
  BalanceService,
  BudgetService,
  SavingsGoalService,
  CategorizationService,
  RecurringService,
  ImportService,
  ForecastService,
  RunwayService,
  BudgetProjectionService,
  SyncOutboxService,
  UnconfiguredCloudSyncAdapter,
  NotificationTrackingService,
  FinanceAccount,
  Transaction,
  FinanceCategory,
  formatPaise,
  CashFlowTimelinePoint,
  CategorySpendingItem,
  CategoryBudgetStatus,
  GoalProgressView,
  isIndexedDBAvailable,
  WebIndexedDBSecureStorageAdapter,
} from "@/lib/finance";

import AccountModal from "@/components/finance/AccountModal";
import TransactionModal from "@/components/finance/TransactionModal";
import TransferModal from "@/components/finance/TransferModal";
import TransactionDetailModal from "@/components/finance/TransactionDetailModal";
import BudgetModal from "@/components/finance/BudgetModal";
import SavingsGoalModal from "@/components/finance/SavingsGoalModal";
import CategorizationReviewModal from "@/components/finance/CategorizationReviewModal";
import RecurringPaymentsModal from "@/components/finance/RecurringPaymentsModal";
import StatementImportModal from "@/components/finance/StatementImportModal";
import BankIntegrationModal from "@/components/finance/BankIntegrationModal";
import ForecastViewModal from "@/components/finance/ForecastViewModal";
import SyncSettingsModal from "@/components/finance/SyncSettingsModal";
import KotakTrackingModal from "@/components/finance/KotakTrackingModal";
import CashFlowChart from "@/components/finance/CashFlowChart";
import CategorySpendingChart from "@/components/finance/CategorySpendingChart";

type DashboardTab = "OVERVIEW" | "TRANSACTIONS" | "BUDGETS" | "GOALS" | "ACCOUNTS";
type PeriodPreset = "THIS_MONTH" | "LAST_MONTH" | "LAST_3_MONTHS" | "THIS_YEAR" | "ALL_TIME";

export default function FinanceDashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("OVERVIEW");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("THIS_MONTH");
  const [isLoading, setIsLoading] = useState(true);

  // Core Data
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudgetStatus[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<GoalProgressView[]>([]);

  // Overview Metrics
  const [netWorthPaise, setNetWorthPaise] = useState(0);
  const [totalAssetsPaise, setTotalAssetsPaise] = useState(0);
  const [totalLiabilitiesPaise, setTotalLiabilitiesPaise] = useState(0);
  const [periodIncomePaise, setPeriodIncomePaise] = useState(0);
  const [periodExpensePaise, setPeriodExpensePaise] = useState(0);
  const [periodNetCashFlowPaise, setPeriodNetCashFlowPaise] = useState(0);
  const [timelinePoints, setTimelinePoints] = useState<CashFlowTimelinePoint[]>([]);
  const [spendingBreakdown, setSpendingBreakdown] = useState<CategorySpendingItem[]>([]);

  // Modals state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedTxnForDetail, setSelectedTxnForDetail] = useState<Transaction | null>(null);

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | undefined>();

  const [isSavingsGoalModalOpen, setIsSavingsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalProgressView | null>(null);
  const [savingsGoalMode, setSavingsGoalMode] = useState<"create_or_edit" | "contribute">("create_or_edit");

  // Phase 3 Modal & Engine State
  const [isCategorizationModalOpen, setIsCategorizationModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [detectedRecurringCount, setDetectedRecurringCount] = useState(0);

  // Phase 4 Modal & Forecast State
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);
  const [hasLowBalanceWarning, setHasLowBalanceWarning] = useState(false);

  // Kotak 811 Native Notification Tracking State
  const [isKotakModalOpen, setIsKotakModalOpen] = useState(false);
  const [kotakReviewCount, setKotakReviewCount] = useState(0);
  const [kotakTrackingActive, setKotakTrackingActive] = useState(false);

  // Transactions Filter State
  const [txnSearchQuery, setTxnSearchQuery] = useState("");
  const [txnAccountFilter, setTxnAccountFilter] = useState("ALL");
  const [txnCategoryFilter, setTxnCategoryFilter] = useState("ALL");
  const [txnStatusFilter, setTxnStatusFilter] = useState("ALL");
  const [txnSortOrder, setTxnSortOrder] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");

  // Instances
  const uow = useMemo(() => new IndexedDBUnitOfWork(), []);
  const accountService = useMemo(() => new AccountService(uow), [uow]);
  const transactionService = useMemo(() => new TransactionService(uow), [uow]);
  const balanceService = useMemo(() => new BalanceService(uow), [uow]);
  const budgetService = useMemo(() => new BudgetService(uow), [uow]);
  const savingsGoalService = useMemo(() => new SavingsGoalService(uow), [uow]);
  const categorizationService = useMemo(() => new CategorizationService(uow), [uow]);
  const recurringService = useMemo(() => new RecurringService(uow), [uow]);
  const importService = useMemo(() => new ImportService(uow, transactionService), [uow, transactionService]);
  const forecastService = useMemo(() => new ForecastService(uow), [uow]);
  const runwayService = useMemo(() => new RunwayService(uow), [uow]);
  const budgetProjectionService = useMemo(() => new BudgetProjectionService(uow), [uow]);
  const cloudSyncAdapter = useMemo(() => new UnconfiguredCloudSyncAdapter(), []);
  const syncOutboxService = useMemo(() => new SyncOutboxService(uow, cloudSyncAdapter), [uow, cloudSyncAdapter]);
  const notificationTrackingService = useMemo(
    () => new NotificationTrackingService(uow, transactionService, categorizationService),
    [uow, transactionService, categorizationService]
  );
  const secureAdapter = useMemo(() => new WebIndexedDBSecureStorageAdapter(), []);

  // Compute date boundaries based on period preset
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let label = "This Month";

    if (periodPreset === "THIS_MONTH") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      label = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } else if (periodPreset === "LAST_MONTH") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      label = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } else if (periodPreset === "LAST_3_MONTHS") {
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
      label = "Last 3 Months";
    } else if (periodPreset === "THIS_YEAR") {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      label = `${now.getFullYear()} Year to Date`;
    } else {
      // ALL_TIME
      start = new Date(2020, 0, 1, 0, 0, 0, 0);
      label = "All Time";
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      periodLabel: label,
    };
  }, [periodPreset]);

  // Main Data Refresh Callback
  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!isIndexedDBAvailable()) {
        setIsLoading(false);
        return;
      }

      // Ensure system categories exist
      let allCats = await uow.categories.getAll();
      if (allCats.length === 0) {
        await uow.categories.seedDefaults();
        allCats = await uow.categories.getAll();
      }
      setCategories(allCats);

      // Fetch accounts and net worth
      const allAccounts = await uow.accounts.getAll();
      setAccounts(allAccounts);

      const nw = await balanceService.getNetWorth();
      setNetWorthPaise(nw.netWorthPaise);
      setTotalAssetsPaise(nw.totalAssetsPaise);
      setTotalLiabilitiesPaise(nw.totalLiabilitiesPaise);

      // Fetch period-dependent cash flow and reports
      const flow = await balanceService.getCashFlow(startDate, endDate);
      setPeriodIncomePaise(flow.totalIncomePaise);
      setPeriodExpensePaise(flow.totalExpensesPaise);
      setPeriodNetCashFlowPaise(flow.netCashFlowPaise);

      const timeline = await balanceService.getCashFlowTimeline(startDate, endDate);
      setTimelinePoints(timeline);

      const breakdown = await balanceService.getCategorySpendingBreakdown(startDate, endDate);
      setSpendingBreakdown(breakdown);

      // Budgets
      const budgetReport = await budgetService.getCategoryBudgetStatuses(startDate, endDate);
      setBudgets(budgetReport.statuses);

      // Savings Goals
      const goals = await savingsGoalService.getGoalsWithProgress();
      setSavingsGoals(goals);

      // Transactions
      const allTxns = await uow.transactions.query({ limit: 200 });
      setTransactions(allTxns);

      // Uncategorized review count
      const uncategorized = await categorizationService.getUncategorizedTransactions();
      setUncategorizedCount(uncategorized.length);

      // Detected subscriptions count
      const detectedRules = await recurringService.getRecurringRules("detected");
      setDetectedRecurringCount(detectedRules.length);

      // Outbox status
      const pendingOps = await uow.outbox.getPending();
      setPendingOutboxCount(pendingOps.length);

      // Low balance / runway alert check
      try {
        const rw = await runwayService.computeRunway();
        setHasLowBalanceWarning(rw.runwayMonths !== null && rw.runwayMonths < 1.0);
      } catch {
        setHasLowBalanceWarning(false);
      }

      // Kotak Notification Tracking status
      try {
        const trackingStatus = await notificationTrackingService.getStatus();
        setKotakTrackingActive(trackingStatus.enabled && trackingStatus.permissionGranted);
        setKotakReviewCount(trackingStatus.pendingReviewCount);
      } catch {
        // Ignored
      }
    } catch (err) {
      console.error("Failed to load finance data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [uow, balanceService, budgetService, savingsGoalService, categorizationService, recurringService, runwayService, notificationTrackingService, startDate, endDate]);

  useEffect(() => {
    notificationTrackingService.initialize().catch((err) => {
      console.warn("Kotak tracking initialization:", err);
    });
  }, [notificationTrackingService]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Filtered transactions for the Transactions Tab
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (txnSearchQuery.trim()) {
      const q = txnSearchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          (t.merchant && t.merchant.toLowerCase().includes(q)) ||
          (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    if (txnAccountFilter !== "ALL") {
      result = result.filter((t) => t.accountId === txnAccountFilter);
    }

    if (txnCategoryFilter !== "ALL") {
      result = result.filter((t) => t.categoryId === txnCategoryFilter);
    }

    if (txnStatusFilter !== "ALL") {
      result = result.filter((t) => t.status === txnStatusFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (txnSortOrder === "date_desc") return Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
      if (txnSortOrder === "date_asc") return Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
      if (txnSortOrder === "amount_desc") return b.amountPaise - a.amountPaise;
      if (txnSortOrder === "amount_asc") return a.amountPaise - b.amountPaise;
      return 0;
    });

    return result;
  }, [transactions, txnSearchQuery, txnAccountFilter, txnCategoryFilter, txnStatusFilter, txnSortOrder]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-fade-in pb-16">
      {/* 1. Header Navigation & Mode */}
      <nav className="flex items-center justify-between border-b border-muted pb-4">
        <Link
          href="/secret"
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Private Sanctuary</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-mono tracking-wider text-blue-400 font-semibold uppercase hover:bg-blue-500/20 transition-colors cursor-pointer"
            title="Inspect cloud sync outbox and offline status"
          >
            <CloudOff className="w-3.5 h-3.5" />
            <span>Sync {pendingOutboxCount > 0 ? `(${pendingOutboxCount})` : "Local"}</span>
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono tracking-wider text-emerald-400 font-semibold uppercase">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Vault (Offline)</span>
          </div>
        </div>
      </nav>

      {/* 2. Editorial Title & Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl text-foreground font-normal tracking-tight">
            Life Atlas Finance
          </h1>
          <p className="font-body text-xs sm:text-sm text-muted-foreground mt-0.5">
            Deterministic integer-paise ledger, balanced transfers, and local offline privacy.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setEditingTransaction(null);
              setIsTransactionModalOpen(true);
            }}
            disabled={accounts.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-all disabled:opacity-40 cursor-pointer shadow-xs active:scale-95"
            title={accounts.length === 0 ? "Create an account first" : "Record transaction"}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Transaction</span>
          </button>

          <button
            onClick={() => setIsTransferModalOpen(true)}
            disabled={accounts.length < 2}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-muted bg-surface hover:border-foreground/30 text-xs text-foreground transition-all disabled:opacity-40 cursor-pointer shadow-xs active:scale-95"
            title={accounts.length < 2 ? "Need at least 2 accounts for transfers" : "Transfer money"}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Transfer</span>
          </button>

          <button
            onClick={() => {
              setEditingAccount(null);
              setIsAccountModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-muted bg-surface hover:border-foreground/30 text-xs text-foreground transition-all cursor-pointer shadow-xs active:scale-95"
            title="Add a new bank, cash, or credit account"
          >
            <Landmark className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Add Account</span>
          </button>
        </div>
      </div>

      {/* 2b. Phase 3 & 4 Automation & Ingestion Action Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 text-xs">
        <button
          onClick={() => setIsForecastModalOpen(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all font-medium cursor-pointer shadow-xs whitespace-nowrap ${
            hasLowBalanceWarning
              ? "border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
              : "border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Forecast & Runway</span>
          {hasLowBalanceWarning && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
              Low Balance
            </span>
          )}
        </button>

        <button
          onClick={() => setIsImportModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all font-medium cursor-pointer shadow-xs whitespace-nowrap"
        >
          <FileUp className="w-3.5 h-3.5" />
          <span>Import Statement</span>
        </button>

        <button
          onClick={() => setIsCategorizationModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-all font-medium cursor-pointer shadow-xs whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Smart Rules</span>
          {uncategorizedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-black font-bold">
              {uncategorizedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setIsRecurringModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-all font-medium cursor-pointer shadow-xs whitespace-nowrap"
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Recurring & Bills</span>
          {detectedRecurringCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500 text-white font-bold">
              {detectedRecurringCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setIsKotakModalOpen(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all font-medium cursor-pointer shadow-xs whitespace-nowrap ${
            kotakTrackingActive
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
          }`}
        >
          <BellRing className="w-3.5 h-3.5" />
          <span>Kotak 811 Tracking</span>
          {kotakReviewCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-black font-bold">
              {kotakReviewCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setIsBankModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-muted bg-surface hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs whitespace-nowrap"
        >
          <Landmark className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Bank Consent (AA)</span>
        </button>
      </div>

      {/* 3. Reporting Period Selector & Tabs Navigation */}
      <div className="space-y-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-muted overflow-x-auto no-scrollbar text-xs">
          {(
            [
              { id: "OVERVIEW", label: "Overview" },
              { id: "TRANSACTIONS", label: `Transactions (${transactions.length})` },
              { id: "BUDGETS", label: `Budgets (${budgets.length})` },
              { id: "GOALS", label: `Goals (${savingsGoals.length})` },
              { id: "ACCOUNTS", label: `Accounts (${accounts.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Reporting Period Filter Bar (visible on Overview, Budgets, and Transactions) */}
        {(activeTab === "OVERVIEW" || activeTab === "BUDGETS") && (
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="font-sans text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Period: <span className="text-foreground">{periodLabel}</span>
            </span>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: "THIS_MONTH", label: "This Month" },
                  { id: "LAST_MONTH", label: "Last Month" },
                  { id: "LAST_3_MONTHS", label: "3M" },
                  { id: "THIS_YEAR", label: "Year" },
                  { id: "ALL_TIME", label: "All" },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setPeriodPreset(preset.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-sans font-medium transition-colors cursor-pointer ${
                    periodPreset === preset.id
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Tab Contents */}

      {/* =========================================================================
          TAB 1: OVERVIEW DASHBOARD
         ========================================================================= */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6">
          {/* A. Financial Overview Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Net Worth Card */}
            <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/30 bg-surface/80 relative overflow-hidden space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Total Net Worth
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="font-display text-2xl sm:text-3xl font-semibold text-emerald-400">
                {formatPaise(netWorthPaise)}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono flex items-center justify-between pt-1">
                <span>Assets: {formatPaise(totalAssetsPaise)}</span>
                <span>Debt: {formatPaise(totalLiabilitiesPaise)}</span>
              </div>
            </div>

            {/* Income Card */}
            <div className="p-4 sm:p-5 rounded-2xl border border-muted bg-surface space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Income ({periodLabel.split(" ")[0]})
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="font-display text-xl sm:text-2xl font-semibold text-foreground">
                {formatPaise(periodIncomePaise)}
              </div>
              <div className="text-[10px] text-muted-foreground font-sans pt-1">
                Excludes internal account transfers
              </div>
            </div>

            {/* Expenses Card */}
            <div className="p-4 sm:p-5 rounded-2xl border border-muted bg-surface space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Expenses ({periodLabel.split(" ")[0]})
                </span>
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="font-display text-xl sm:text-2xl font-semibold text-foreground">
                {formatPaise(periodExpensePaise)}
              </div>
              <div className="text-[10px] font-mono pt-1">
                <span className="text-muted-foreground">Net Cash Flow: </span>
                <span className={periodNetCashFlowPaise >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {periodNetCashFlowPaise >= 0 ? "+" : ""}
                  {formatPaise(periodNetCashFlowPaise)}
                </span>
              </div>
            </div>
          </div>

          {/* B. Empty State when 0 accounts exist */}
          {accounts.length === 0 && (
            <div className="p-8 sm:p-10 rounded-2xl border border-dashed border-muted text-center space-y-3 bg-surface/30">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Wallet className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="font-display text-lg text-foreground font-normal">Welcome to Life Atlas Finance</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Start by adding your first account (Primary Bank, Savings, Cash, or Credit Card) to begin tracking your net worth and cash flow offline.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setIsAccountModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Your First Account</span>
              </button>
            </div>
          )}

          {/* C. Accounts Grid Snapshot */}
          {accounts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
                  Accounts Overview
                </h3>
                <button
                  onClick={() => setActiveTab("ACCOUNTS")}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-sans flex items-center gap-1 cursor-pointer"
                >
                  <span>Manage</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {accounts.slice(0, 3).map((acc) => {
                  const isCredit = acc.accountType === "credit";
                  return (
                    <div
                      key={acc.id}
                      onClick={() => {
                        setTxnAccountFilter(acc.id);
                        setActiveTab("TRANSACTIONS");
                      }}
                      className="p-4 rounded-xl border border-muted bg-surface hover:border-foreground/30 transition-all cursor-pointer group space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <div className="w-7 h-7 rounded-lg bg-background border border-muted/80 flex items-center justify-center shrink-0">
                            {isCredit ? (
                              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <Landmark className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                          </div>
                          <span className="font-semibold text-xs text-foreground truncate group-hover:text-emerald-400 transition-colors">
                            {acc.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground uppercase">
                          {acc.accountType}
                        </span>
                      </div>

                      <div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {isCredit ? "Outstanding Balance (Debt)" : "Available Balance"}
                        </div>
                        <div
                          className={`font-display text-lg font-semibold ${
                            isCredit ? "text-amber-400" : "text-emerald-400"
                          }`}
                        >
                          {formatPaise(acc.currentBalancePaise)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* D. Visual Analytics Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CashFlowChart
              timeline={timelinePoints}
              totalIncomePaise={periodIncomePaise}
              totalExpensesPaise={periodExpensePaise}
            />
            <CategorySpendingChart
              categories={spendingBreakdown}
              totalExpensesPaise={periodExpensePaise}
            />
          </div>

          {/* E. Recent Transactions Snapshot */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Activity
              </h3>
              {transactions.length > 0 && (
                <button
                  onClick={() => setActiveTab("TRANSACTIONS")}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-sans flex items-center gap-1 cursor-pointer"
                >
                  <span>View All ({transactions.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {transactions.length === 0 ? (
              <div className="p-6 rounded-xl border border-muted bg-surface/50 text-center space-y-1">
                <p className="text-xs text-muted-foreground">No transactions recorded yet.</p>
                {accounts.length > 0 && (
                  <button
                    onClick={() => {
                      setEditingTransaction(null);
                      setIsTransactionModalOpen(true);
                    }}
                    className="text-xs text-emerald-400 hover:underline font-semibold cursor-pointer"
                  >
                    + Record your first transaction
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {transactions.slice(0, 5).map((t) => {
                  const acc = accounts.find((a) => a.id === t.accountId);
                  const isTransfer = !!t.transferGroupId;
                  const isReversed = t.status === "reversed";

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTxnForDetail(t)}
                      className="p-3 rounded-xl border border-muted bg-surface hover:border-foreground/30 transition-all flex items-center justify-between text-xs cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 truncate pr-2">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                            isTransfer
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                              : t.direction === "inflow"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-surface border-muted text-muted-foreground"
                          }`}
                        >
                          {isTransfer ? (
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          ) : t.direction === "inflow" ? (
                            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-rose-400" />
                          )}
                        </div>

                        <div className="truncate space-y-0.5">
                          <div
                            className={`font-medium truncate group-hover:text-emerald-400 transition-colors ${
                              isReversed ? "line-through text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {t.description}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                            <span>{acc?.name || "Account"}</span>
                            <span>·</span>
                            <span>{t.occurredAt.split("T")[0]}</span>
                            {t.status !== "posted" && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-muted/60 uppercase">
                                {t.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`font-mono font-semibold ${
                            isReversed
                              ? "line-through text-muted-foreground opacity-60"
                              : isTransfer
                              ? "text-blue-400"
                              : t.direction === "inflow"
                              ? "text-emerald-400"
                              : "text-foreground"
                          }`}
                        >
                          {t.direction === "inflow" ? "+" : "-"}
                          {formatPaise(t.amountPaise)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: TRANSACTIONS HISTORY & ADVANCED FILTERING
         ========================================================================= */}
      {activeTab === "TRANSACTIONS" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="p-4 rounded-2xl border border-muted bg-surface space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search descriptions, merchants, memos..."
                  value={txnSearchQuery}
                  onChange={(e) => setTxnSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-background border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Account Filter */}
              <select
                value={txnAccountFilter}
                onChange={(e) => setTxnAccountFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-background border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={txnCategoryFilter}
                onChange={(e) => setTxnCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-background border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={txnStatusFilter}
                onChange={(e) => setTxnStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-background border border-muted text-xs text-foreground focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Status</option>
                <option value="posted">Posted</option>
                <option value="pending">Pending</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>

            {/* Sort & Count Bar */}
            <div className="flex items-center justify-between text-[11px] font-sans text-muted-foreground pt-1 border-t border-muted/50">
              <span>Showing {filteredTransactions.length} of {transactions.length} records</span>
              <div className="flex items-center gap-1.5">
                <span>Sort by:</span>
                <select
                  value={txnSortOrder}
                  onChange={(e) => setTxnSortOrder(e.target.value as "date_desc" | "date_asc" | "amount_desc" | "amount_asc")}
                  className="bg-transparent text-foreground border-none font-medium focus:outline-none cursor-pointer"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="amount_desc">Highest Amount</option>
                  <option value="amount_asc">Lowest Amount</option>
                </select>
              </div>
            </div>
          </div>

          {/* Transactions List */}
          {filteredTransactions.length === 0 ? (
            <div className="p-8 rounded-2xl border border-muted bg-surface/50 text-center space-y-2">
              <p className="text-xs text-muted-foreground">No matching transactions found.</p>
              {(txnSearchQuery || txnAccountFilter !== "ALL" || txnCategoryFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setTxnSearchQuery("");
                    setTxnAccountFilter("ALL");
                    setTxnCategoryFilter("ALL");
                    setTxnStatusFilter("ALL");
                  }}
                  className="text-xs text-emerald-400 hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredTransactions.map((t) => {
                const acc = accounts.find((a) => a.id === t.accountId);
                const cat = categories.find((c) => c.id === t.categoryId);
                const isTransfer = !!t.transferGroupId;
                const isReversed = t.status === "reversed";

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTxnForDetail(t)}
                    className="p-3.5 rounded-xl border border-muted bg-surface hover:border-foreground/30 transition-all flex items-center justify-between text-xs cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 truncate pr-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          isTransfer
                            ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                            : t.direction === "inflow"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-surface border-muted text-muted-foreground"
                        }`}
                      >
                        {isTransfer ? (
                          <ArrowRightLeft className="w-4 h-4" />
                        ) : t.direction === "inflow" ? (
                          <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-rose-400" />
                        )}
                      </div>

                      <div className="truncate space-y-0.5">
                        <div
                          className={`font-semibold text-sm truncate group-hover:text-emerald-400 transition-colors ${
                            isReversed ? "line-through text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {t.description}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2 flex-wrap">
                          <span className="font-sans text-foreground/80">{acc?.name}</span>
                          <span>·</span>
                          <span>{cat?.name || "Uncategorized"}</span>
                          <span>·</span>
                          <span>{t.occurredAt.split("T")[0]}</span>
                          {t.status !== "posted" && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                                isReversed
                                  ? "bg-rose-500/20 text-rose-400"
                                  : "bg-amber-500/20 text-amber-400"
                              }`}
                            >
                              {t.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono font-semibold text-sm ${
                          isReversed
                            ? "line-through text-muted-foreground opacity-60"
                            : isTransfer
                            ? "text-blue-400"
                            : t.direction === "inflow"
                            ? "text-emerald-400"
                            : "text-foreground"
                        }`}
                      >
                        {t.direction === "inflow" ? "+" : "-"}
                        {formatPaise(t.amountPaise)}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">v{t.version || 1}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: BUDGETS MANAGER
         ========================================================================= */}
      {activeTab === "BUDGETS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg text-foreground font-normal">Monthly Category Budgets</h3>
              <p className="text-xs text-muted-foreground">Track expense limits for {periodLabel}.</p>
            </div>

            <button
              onClick={() => {
                setEditingBudgetId(undefined);
                setIsBudgetModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Set Category Budget</span>
            </button>
          </div>

          {budgets.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-muted text-center space-y-3 bg-surface/30">
              <Tag className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <div className="space-y-1 max-w-sm mx-auto">
                <h4 className="font-sans font-semibold text-sm text-foreground">No Budgets Set Yet</h4>
                <p className="text-xs text-muted-foreground">
                  Set target monthly spending limits for categories like Food, Utilities, Transport, or Shopping.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingBudgetId(undefined);
                  setIsBudgetModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Your First Budget</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {budgets.map((b) => {
                const isOver = b.isOverBudget;
                const isNear = b.isApproachingLimit;

                return (
                  <div
                    key={b.categoryId}
                    className="p-4 rounded-xl border border-muted bg-surface space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="font-semibold text-xs text-foreground truncate">{b.categoryName}</span>
                        {isOver && (
                          <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Over Limit
                          </span>
                        )}
                        {isNear && (
                          <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            {b.percentageUsed}%
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setEditingBudgetId(b.categoryId);
                          setIsBudgetModalOpen(true);
                        }}
                        className="text-[11px] text-muted-foreground hover:text-emerald-400 font-sans cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="h-2 w-full bg-surface-hover rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOver ? "bg-rose-500" : isNear ? "bg-amber-500" : "bg-emerald-400"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(2, b.percentageUsed))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-0.5">
                        <span>Spent: {formatPaise(b.spentPaise)}</span>
                        <span>Limit: {formatPaise(b.allocatedPaise)}</span>
                      </div>
                    </div>

                    <div className="text-[11px] font-sans text-muted-foreground">
                      {isOver ? (
                        <span className="text-rose-400 font-semibold">
                          Exceeded by {formatPaise(Math.abs(b.remainingPaise))}
                        </span>
                      ) : (
                        <span>{formatPaise(b.remainingPaise)} remaining</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: SAVINGS GOALS
         ========================================================================= */}
      {activeTab === "GOALS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg text-foreground font-normal">Savings Goals</h3>
              <p className="text-xs text-muted-foreground">Track progress toward specific financial horizons.</p>
            </div>

            <button
              onClick={() => {
                setEditingGoal(null);
                setSavingsGoalMode("create_or_edit");
                setIsSavingsGoalModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Goal</span>
            </button>
          </div>

          {savingsGoals.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-muted text-center space-y-3 bg-surface/30">
              <Target className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <div className="space-y-1 max-w-sm mx-auto">
                <h4 className="font-sans font-semibold text-sm text-foreground">No Goals Created</h4>
                <p className="text-xs text-muted-foreground">
                  Set targets for travel expeditions, equipment purchases, or an emergency safety buffer.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingGoal(null);
                  setSavingsGoalMode("create_or_edit");
                  setIsSavingsGoalModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Your First Goal</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savingsGoals.map((g) => {
                return (
                  <div
                    key={g.id}
                    className="p-4 sm:p-5 rounded-2xl border border-muted bg-surface space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: g.color || "#10B981" }}
                        />
                        <span className="font-semibold text-sm text-foreground truncate">{g.name}</span>
                      </div>

                      {g.isCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold uppercase">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Reached</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono font-semibold text-emerald-400">
                          {g.percentComplete}%
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="h-2 w-full bg-surface-hover rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(3, g.percentComplete))}%`,
                            backgroundColor: g.color || "#10B981",
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-0.5">
                        <span>Saved: {formatPaise(g.currentAmountPaise)}</span>
                        <span>Target: {formatPaise(g.targetAmountPaise)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-muted/50">
                      <span className="text-muted-foreground text-[11px]">
                        {g.daysRemaining !== undefined ? `${g.daysRemaining} days left` : "No deadline"}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingGoal(g);
                            setSavingsGoalMode("contribute");
                            setIsSavingsGoalModalOpen(true);
                          }}
                          className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                        >
                          + Add Progress
                        </button>
                        <span>·</span>
                        <button
                          onClick={() => {
                            setEditingGoal(g);
                            setSavingsGoalMode("create_or_edit");
                            setIsSavingsGoalModalOpen(true);
                          }}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Edit
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

      {/* =========================================================================
          TAB 5: ACCOUNTS DIRECTORY & MANAGEMENT
         ========================================================================= */}
      {activeTab === "ACCOUNTS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg text-foreground font-normal">All Tracked Accounts</h3>
              <p className="text-xs text-muted-foreground">Assets and liabilities kept strictly in balance.</p>
            </div>

            <button
              onClick={() => {
                setEditingAccount(null);
                setIsAccountModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Account</span>
            </button>
          </div>

          <div className="space-y-3">
            {accounts.map((acc) => {
              const isCredit = acc.accountType === "credit";
              const isArchived = acc.status === "archived";

              return (
                <div
                  key={acc.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isArchived
                      ? "border-muted/50 bg-surface/30 opacity-60"
                      : "border-muted bg-surface hover:border-foreground/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-background border border-muted flex items-center justify-center shrink-0">
                      {isCredit ? (
                        <CreditCard className="w-5 h-5 text-amber-400" />
                      ) : (
                        <Landmark className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{acc.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/60 text-muted-foreground uppercase">
                          {acc.accountType}
                        </span>
                        {isArchived && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 uppercase">
                            Archived
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                        {acc.metadata?.institutionName && (
                          <span>{acc.metadata.institutionName}</span>
                        )}
                        {acc.metadata?.accountNumberLast4 && (
                          <span>· •••• {acc.metadata.accountNumberLast4}</span>
                        )}
                        <span>· Opened with {formatPaise(acc.openingBalancePaise)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-muted/50">
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {isCredit ? "Debt Owed" : "Current Balance"}
                      </div>
                      <div
                        className={`font-display text-lg font-semibold ${
                          isCredit ? "text-amber-400" : "text-emerald-400"
                        }`}
                      >
                        {formatPaise(acc.currentBalancePaise)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingAccount(acc);
                          setIsAccountModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg border border-muted hover:border-foreground/30 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Edit account details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {!isArchived && (
                        <button
                          onClick={async () => {
                            if (confirm(`Archive ${acc.name}? It will be hidden from new transactions.`)) {
                              await accountService.archiveAccount(acc.id);
                              refreshAll();
                            }
                          }}
                          className="p-1.5 rounded-lg border border-muted hover:border-rose-500/30 text-muted-foreground hover:text-rose-400 cursor-pointer"
                          title="Archive account"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Modals for User Flows */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        onSuccess={refreshAll}
        accountService={accountService}
        editingAccount={editingAccount}
      />

      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSuccess={refreshAll}
        transactionService={transactionService}
        accounts={accounts.filter((a) => a.status === "active")}
        categories={categories}
        editingTransaction={editingTransaction}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={refreshAll}
        transactionService={transactionService}
        accounts={accounts.filter((a) => a.status === "active")}
      />

      <TransactionDetailModal
        isOpen={!!selectedTxnForDetail}
        onClose={() => setSelectedTxnForDetail(null)}
        onSuccess={refreshAll}
        onEdit={(txn) => {
          setSelectedTxnForDetail(null);
          setEditingTransaction(txn);
          setIsTransactionModalOpen(true);
        }}
        transaction={selectedTxnForDetail}
        accounts={accounts}
        categories={categories}
        transactionService={transactionService}
      />

      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        onSuccess={refreshAll}
        budgetService={budgetService}
        categories={categories}
        editingCategoryId={editingBudgetId}
      />

      <SavingsGoalModal
        isOpen={isSavingsGoalModalOpen}
        onClose={() => setIsSavingsGoalModalOpen(false)}
        onSuccess={refreshAll}
        savingsGoalService={savingsGoalService}
        editingGoal={editingGoal}
        mode={savingsGoalMode}
      />

      <CategorizationReviewModal
        isOpen={isCategorizationModalOpen}
        onClose={() => setIsCategorizationModalOpen(false)}
        categorizationService={categorizationService}
        categories={categories}
        onTransactionsUpdated={refreshAll}
      />

      <RecurringPaymentsModal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        recurringService={recurringService}
        accounts={accounts}
        categories={categories}
      />

      <StatementImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        accounts={accounts}
        importService={importService}
        onImportComplete={refreshAll}
      />

      <BankIntegrationModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
      />

      <ForecastViewModal
        isOpen={isForecastModalOpen}
        onClose={() => setIsForecastModalOpen(false)}
        forecastService={forecastService}
        runwayService={runwayService}
        budgetProjectionService={budgetProjectionService}
      />

      <SyncSettingsModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        uow={uow}
        syncOutboxService={syncOutboxService}
      />

      <KotakTrackingModal
        isOpen={isKotakModalOpen}
        onClose={() => setIsKotakModalOpen(false)}
        trackingService={notificationTrackingService}
        accounts={accounts}
        categories={categories}
        onTransactionsUpdated={refreshAll}
      />
    </div>
  );
}
