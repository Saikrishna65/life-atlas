"use client";

import { openDemoDatabase, seedFinanceDemo, createDemoCapture } from "@/lib/finance/demo";
import FinanceThemePicker, { FinanceTheme, THEME_STORAGE_KEY, isFinanceTheme } from "@/components/finance/FinanceThemePicker";
import AnimatedMoney from "@/components/finance/AnimatedMoney";
import { usePendingFinanceCount } from "@/lib/finance/usePendingFinanceCount";
import FinanceSelect from "@/components/finance/FinanceSelect";

import "@/app/secret/finance/finance.css";
import { App } from "@capacitor/app";
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
  LayoutDashboard,
  ListFilter,
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
  const isDemo = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
  const [theme, setTheme] = useState<FinanceTheme>(() => {
    try { const saved = localStorage.getItem(THEME_STORAGE_KEY); return isFinanceTheme(saved) ? saved : "ocean"; } catch { return "ocean"; }
  });
  useEffect(() => {
    document.documentElement.dataset.financeTheme = theme;
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Theme still works when storage is unavailable. */ }
    return () => { delete document.documentElement.dataset.financeTheme; };
  }, [theme]);
  const realPendingCount = usePendingFinanceCount();
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

  const pendingFinanceCount = isDemo ? kotakReviewCount : realPendingCount;

  // Instances
  const uow = useMemo(() => new IndexedDBUnitOfWork(isDemo ? openDemoDatabase() : undefined), [isDemo]);
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
    () => new NotificationTrackingService(uow, transactionService, categorizationService, isDemo ? createDemoCapture() : undefined),
    [uow, transactionService, categorizationService, isDemo]
  );
  const secureAdapter = useMemo(() => new WebIndexedDBSecureStorageAdapter(), []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("review") === "1") setIsKotakModalOpen(true);
  }, []);

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

      if (isDemo) await seedFinanceDemo(uow);

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
    const resume = () => {
      if (document.visibilityState === "visible") {
        notificationTrackingService.drainPendingNotifications().catch(console.warn);
      }
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    const nativeResume = App.addListener("appStateChange", ({ isActive }) => { if (isActive) resume(); });
    (async () => { if (isDemo) await seedFinanceDemo(uow); await notificationTrackingService.initialize(); await refreshAll(); })().catch(console.warn);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      void nativeResume.then((listener) => listener.remove());
      void notificationTrackingService.dispose();
    };
  }, [notificationTrackingService]);

  useEffect(() => {
    const refresh = () => { void refreshAll(); };
    window.addEventListener("finance-notifications-updated", refresh);
    return () => window.removeEventListener("finance-notifications-updated", refresh);
  }, [refreshAll]);

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

  const tabs = [
    { id: "OVERVIEW", label: "Overview", icon: LayoutDashboard },
    { id: "TRANSACTIONS", label: "Activity", icon: ArrowRightLeft },
    { id: "BUDGETS", label: "Budgets", icon: Tag },
    { id: "GOALS", label: "Goals", icon: Target },
    { id: "ACCOUNTS", label: "Accounts", icon: Wallet },
  ] as const;
  const newAccount = () => { setEditingAccount(null); setIsAccountModalOpen(true); };
  const newEntry = () => { setEditingTransaction(null); setIsTransactionModalOpen(true); };
  const accountView = (all = false) => <div className={all ? "af-account-grid" : "af-account-strip"}>
    {(all ? accounts : accounts.filter(a => a.status === "active").slice(0, 4)).map((account, index) => <article key={account.id} className={`af-account af-account-${index % 3}`}>
      <div className="af-account-top"><span className="af-account-icon">{account.accountType === "credit" ? <CreditCard size={20} /> : <Landmark size={20} />}</span><span>{account.metadata?.institutionName || "ATLAS"} · {account.accountType}{account.status === "archived" ? " · archived" : ""}</span>
        {all && <button aria-label={`Edit ${account.name}`} onClick={() => { setEditingAccount(account); setIsAccountModalOpen(true); }}><Edit3 size={16} /></button>}
      </div>
      <button className="af-account-open" onClick={() => { setTxnAccountFilter(account.id); setActiveTab("TRANSACTIONS"); }}><strong>{account.name}</strong><span className="af-account-number">{account.metadata?.accountNumberLast4 ? `•••• ${account.metadata.accountNumberLast4}` : account.metadata?.institutionName || "Personal account"}</span><b>{formatPaise(account.currentBalancePaise)}</b><span className="glass-card-bottom"><span>ATLAS / PERSONAL</span><CreditCard size={20}/></span></button>
      {all && account.status !== "archived" && <button className="af-text-button" onClick={async () => { if (confirm(`Archive ${account.name}? Existing transactions will be kept.`)) { await accountService.archiveAccount(account.id); await refreshAll(); } }}>Archive account</button>}
    </article>)}
    {!all && <button className="af-add-account" onClick={newAccount} title="Add a new bank, cash, or credit account"><Plus size={22} /><span>Add account</span></button>}
  </div>;
  const activityView = (items: Transaction[]) => <div className="af-activity-list">{items.length ? items.map(transaction => {
    const category = categories.find(c => c.id === transaction.categoryId);
    const account = accounts.find(a => a.id === transaction.accountId);
    return <button key={transaction.id} className="af-activity-row" onClick={() => setSelectedTxnForDetail(transaction)}>
      <span className={`af-entry-icon ${transaction.direction === "inflow" ? "is-income" : ""}`}>{(transaction.merchant || transaction.description).slice(0,1).toUpperCase()}</span>
      <span className="af-entry-description"><strong>{transaction.description}</strong><small>{category?.name || "Uncategorized"} <span>· {account?.name || "Account"}</span></small></span>
      <span className={`af-entry-value ${transaction.direction === "inflow" ? "is-income" : ""} ${transaction.status === "reversed" ? "is-reversed" : ""}`}><strong>{transaction.direction === "inflow" ? "+" : "−"}{formatPaise(transaction.amountPaise)}</strong><small>{new Date(transaction.occurredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}{transaction.status !== "posted" ? ` · ${transaction.status}` : ""}</small></span>
    </button>;
  }) : <div className="af-empty"><ArrowRightLeft size={28} /><h3>A fresh start.</h3><p>Your approved transactions will appear here.</p>{accounts.length > 0 && <button className="af-primary" onClick={newEntry}>Record a transaction</button>}</div>}</div>;

  return (
    <div className="atlas-finance af-shell" data-finance-theme={theme} aria-busy={isLoading}>
      <div className="af-workspace">
        <header className="glass-masthead">
          <Link href="/secret" className="glass-back" aria-label="Return to Life Atlas"><ArrowLeft size={20}/></Link>
          <div><h1>Atlas Finance</h1></div>
          <FinanceThemePicker value={theme} onChange={setTheme}/>
          <button className="glass-bell" aria-label={`${pendingFinanceCount} transactions awaiting approval`} onClick={()=>setIsKotakModalOpen(true)}><BellRing size={18}/>{pendingFinanceCount>0 && <b>{pendingFinanceCount}</b>}</button>
        </header>
        <div className="glass-demo-note"><span>{isDemo ? "Demo workspace" : "Personal finance"}</span><a href={isDemo ? "?" : "?demo=1"}>{isDemo ? "Exit demo" : "Try demo"}<ArrowUpRight size={13}/></a></div>
        <nav role="tablist" aria-label="Finance sections" className="af-navigation">{tabs.map(tab=><button key={tab.id} role="tab" aria-selected={activeTab===tab.id} onClick={()=>{setActiveTab(tab.id);window.scrollTo({top:0});}}><tab.icon size={19}/><span>{tab.label}</span></button>)}</nav>
        <main className={`af-canvas glass-view-${activeTab.toLowerCase()}`} key={activeTab}>
          {activeTab === "OVERVIEW" && <>
            <section className="glass-balance" aria-label="Account balances">
              <span>Your total balance</span><div className="glass-balance-number"><AnimatedMoney value={netWorthPaise}/></div>
              <p><span>Assets <b>{formatPaise(totalAssetsPaise)}</b></span><i/><span>Liabilities <b>{formatPaise(Math.abs(totalLiabilitiesPaise))}</b></span></p>
              <div className="glass-actions"><button disabled={accounts.length<2} onClick={()=>setIsTransferModalOpen(true)}><ArrowUpRight size={16}/>Transfer</button><button className="glass-add" aria-label="Add transaction" onClick={accounts.length ? newEntry : newAccount}><Plus size={23}/></button><button onClick={()=>setIsImportModalOpen(true)}><ArrowDownRight size={16}/>Import</button></div>
            </section>
            <div className="glass-dashboard-grid">
              <div className="glass-main-column">
                <div className="glass-flow"><button onClick={()=>{setTxnSearchQuery("");setActiveTab("TRANSACTIONS");}}><span>↙ Income <ArrowUpRight size={15}/></span><strong><AnimatedMoney value={periodIncomePaise}/></strong><small>Received this period</small></button><button onClick={()=>setActiveTab("TRANSACTIONS")}><span>↗ Expenses <ArrowUpRight size={15}/></span><strong><AnimatedMoney value={periodExpensePaise}/></strong><small>Spent this period</small></button></div>
                <button className="glass-insight" aria-label="Your approval inbox" onClick={()=>setIsKotakModalOpen(true)}><span><Sparkles size={15}/> Message insights <ArrowRightLeft size={15}/></span><strong>{pendingFinanceCount ? `${pendingFinanceCount} payments ready to review` : "Your inbox is up to date"}</strong><small>Confirm the categories. Stay in control.</small></button>
                <section className="glass-wallet-preview"><div className="af-section-heading"><h3>Your wallet</h3><button className="af-text-button" onClick={()=>setActiveTab("ACCOUNTS")}>Open wallet <ChevronRight size={15}/></button></div>{accountView()}</section>
                <section className="glass-recent"><div className="af-section-heading"><h3>Recent transactions</h3><button className="af-text-button" onClick={()=>setActiveTab("TRANSACTIONS")}>See all</button></div>{activityView(transactions.slice(0,5))}</section>
              </div>
              <div className="glass-insights-column"><div className="glass-period"><span>Insights</span><FinanceSelect aria-label="Reporting period" value={periodPreset} onChange={e=>setPeriodPreset(e.target.value as PeriodPreset)}><option value="THIS_MONTH">This month</option><option value="LAST_MONTH">Last month</option><option value="LAST_3_MONTHS">Last 3 months</option><option value="THIS_YEAR">This year</option><option value="ALL_TIME">All time</option></FinanceSelect></div><CashFlowChart startDate={periodPreset === "ALL_TIME" && timelinePoints.length ? timelinePoints[0].dateKey : startDate} endDate={endDate} periodLabel={periodLabel} timeline={timelinePoints} totalIncomePaise={periodIncomePaise} totalExpensesPaise={periodExpensePaise}/><CategorySpendingChart categories={spendingBreakdown} totalExpensesPaise={periodExpensePaise}/></div>
            </div>
          </>}
          {activeTab !== "OVERVIEW" && <header className="glass-section-title"><p>YOUR FINANCIAL SPACE</p><h2>{activeTab==="ACCOUNTS" ? "Wallet" : activeTab==="TRANSACTIONS" ? "Transactions" : activeTab==="BUDGETS" ? "Spending plan" : "Dream it. Save for it."}</h2><span>{periodLabel}</span></header>}
          {activeTab === "TRANSACTIONS" && <section className="af-section af-paper"><div className="af-filters"><label className="af-search"><Search size={18} /><input aria-label="Search transactions" placeholder="Find a transaction…" value={txnSearchQuery} onChange={e => setTxnSearchQuery(e.target.value)} /></label><FinanceSelect aria-label="Filter account" value={txnAccountFilter} onChange={e => setTxnAccountFilter(e.target.value)}><option value="ALL">All Accounts</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</FinanceSelect><FinanceSelect aria-label="Filter category" value={txnCategoryFilter} onChange={e => setTxnCategoryFilter(e.target.value)}><option value="ALL">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</FinanceSelect><FinanceSelect aria-label="Filter status" value={txnStatusFilter} onChange={e => setTxnStatusFilter(e.target.value)}><option value="ALL">Any status</option><option value="posted">Posted</option><option value="pending">Pending</option><option value="reversed">Reversed</option></FinanceSelect></div><div className="af-list-heading"><span>{filteredTransactions.length} transactions</span><FinanceSelect aria-label="Sort transactions" value={txnSortOrder} onChange={e => setTxnSortOrder(e.target.value as typeof txnSortOrder)}><option value="date_desc">Newest first</option><option value="date_asc">Oldest first</option><option value="amount_desc">Highest amount</option><option value="amount_asc">Lowest amount</option></FinanceSelect></div>{activityView(filteredTransactions)}</section>}
          {activeTab === "BUDGETS" && <section className="af-section"><div className="af-section-heading"><h3>Your spending plan</h3><button className="af-primary" onClick={() => { setEditingBudgetId(undefined); setIsBudgetModalOpen(true); }}><Plus size={17} />Create budget</button></div>{budgets.length ? <div className="af-plan-grid">{budgets.map(b => <article className="af-plan" key={b.categoryId}><div className="af-section-heading"><span className="af-plan-icon"><Tag size={21} /></span><button className="af-icon-button" aria-label={`Edit ${b.categoryName} budget`} onClick={() => { setEditingBudgetId(b.categoryId); setIsBudgetModalOpen(true); }}><Edit3 size={17} /></button></div><h3>{b.categoryName}</h3><strong>{formatPaise(b.spentPaise)} <small>of {formatPaise(b.allocatedPaise)}</small></strong><div className={`af-progress ${b.isOverBudget ? "is-over" : ""}`} role="progressbar" aria-label={b.categoryName} aria-valuenow={Math.min(100,b.percentageUsed)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100,Math.max(0,b.percentageUsed))}%` }} /></div><p>{b.isOverBudget ? `${formatPaise(Math.abs(b.remainingPaise))} over your plan` : `${formatPaise(b.remainingPaise)} left to spend`}</p></article>)}</div> : <div className="af-empty af-empty-large"><Tag size={36} /><h3>Spend with a plan.</h3><p>Create category limits to see what’s available before you spend.</p><button className="af-primary" onClick={() => setIsBudgetModalOpen(true)}>Create your first budget</button></div>}</section>}
          {activeTab === "GOALS" && <section className="af-section"><div className="af-section-heading"><h3>Something to look forward to</h3><button className="af-primary" onClick={() => { setEditingGoal(null); setSavingsGoalMode("create_or_edit"); setIsSavingsGoalModalOpen(true); }}><Plus size={17} />New goal</button></div>{savingsGoals.length ? <div className="af-plan-grid">{savingsGoals.map(g => <article className="af-plan af-goal" key={g.id}><div className="af-section-heading"><span className="af-goal-symbol"><Target size={25} /></span><span className="af-tag">{g.isCompleted ? "Reached" : `${g.percentComplete}% saved`}</span></div><span className="glass-goal-label">SAVING FOR</span><h3>{g.name}</h3><strong>{formatPaise(g.currentAmountPaise)}</strong><p>of {formatPaise(g.targetAmountPaise)}</p><div className="af-progress" role="progressbar" aria-label={g.name} aria-valuenow={g.percentComplete} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${Math.min(100,g.percentComplete)}%`}} /></div><div className="af-goal-actions"><button className="af-primary" onClick={() => { setEditingGoal(g); setSavingsGoalMode("contribute"); setIsSavingsGoalModalOpen(true); }}>Add savings</button><button className="af-icon-button" aria-label={`Edit ${g.name}`} onClick={() => { setEditingGoal(g); setSavingsGoalMode("create_or_edit"); setIsSavingsGoalModalOpen(true); }}><Edit3 size={17} /></button></div></article>)}</div> : <div className="af-empty af-empty-large"><Target size={36} /><h3>Turn “one day” into a plan.</h3><p>A trip, a new home, or a rainy-day fund. Start with something that matters to you.</p><button className="af-primary" onClick={() => { setEditingGoal(null); setSavingsGoalMode("create_or_edit"); setIsSavingsGoalModalOpen(true); }}>Create your first goal</button></div>}</section>}
          {activeTab === "ACCOUNTS" && <section className="af-section"><div className="af-section-heading"><h3>One place for every balance</h3><button className="af-primary" onClick={newAccount}><Plus size={17} />Add account</button></div>{accounts.length ? accountView(true) : <div className="af-empty af-empty-large"><Wallet size={36} /><h3>Let’s bring your money together.</h3><p>Add an account to start tracking balances and payments.</p><button className="af-primary" onClick={newAccount}>Add account</button></div>}</section>}
          <details className="af-utility-section"><summary>More ways to manage your money <Plus size={17}/></summary><div className="af-section-heading"><h3>Make Finance work for you</h3><span className="af-eyebrow">YOUR TOOLKIT</span></div><div className="af-utility-grid">{[
            {label:"Bank messages",description:kotakTrackingActive ? "Capture is on · review your inbox" : "Capture, categorise, approve",icon:BellRing,action:()=>setIsKotakModalOpen(true),count:pendingFinanceCount},
            {label:"Import a statement",description:"Bring your past payments along",icon:FileUp,action:()=>setIsImportModalOpen(true)},
            {label:"Bills & subscriptions",description:`${detectedRecurringCount || "Review"} recurring payments`,icon:Repeat,action:()=>setIsRecurringModalOpen(true)},
            {label:"Category rules",description:`${uncategorizedCount} transactions to organise`,icon:Sparkles,action:()=>setIsCategorizationModalOpen(true)},
            {label:"Cash flow forecast",description:hasLowBalanceWarning ? "Your cash buffer needs attention" : "See what might be ahead",icon:TrendingUp,action:()=>setIsForecastModalOpen(true)},
            {label:"Storage & sync",description:pendingOutboxCount ? `${pendingOutboxCount} changes saved locally` : "Your data, your device",icon:Cloud,action:()=>setIsSyncModalOpen(true)},
            {label:"Bank connections",description:"Connection options and imports",icon:Landmark,action:()=>setIsBankModalOpen(true)},
          ].map(tool => <button key={tool.label} onClick={tool.action}><tool.icon size={20} /><span><strong>{tool.label}</strong><small>{tool.description}</small></span>{tool.count ? <b>{tool.count}</b> : <ChevronRight size={16} />}</button>)}</div></details>
        </main>
        <footer className="af-footer"><ShieldCheck size={12}/><span>On your device. In your hands.</span></footer>
      </div>
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
        onOpenStatementImport={() => setIsImportModalOpen(true)}
      />
    </div>
  );
}
