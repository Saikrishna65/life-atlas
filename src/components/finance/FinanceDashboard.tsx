"use client";
import TripFinancePanel from "./trips/TripFinancePanel";
import { TripFinanceService } from "@/lib/finance/trips/service";

import { currentFinanceWeek, localFinanceDateKey } from "@/lib/finance/calendar";
import MerchantImage from "@/components/finance/MerchantImage";
import FinanceThemePicker, { FinanceTheme, THEME_STORAGE_KEY, isFinanceTheme } from "@/components/finance/FinanceThemePicker";
import AnimatedMoney from "@/components/finance/AnimatedMoney";
import { usePendingFinanceCount } from "@/lib/finance/usePendingFinanceCount";
import { syncFinanceWidget } from "@/lib/finance/financeWidgetSync";
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
  PiggyBank,
  History,
  AlertTriangle,
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
  SyncOutboxService,
  UnconfiguredCloudSyncAdapter,
  NotificationTrackingService,
  FinanceAccount,
  Transaction,
  FinanceCategory,
  formatPaise,
  CashFlowTimelinePoint,
  CategoryBudgetStatus,
  GoalProgressView,
  SavingsPocket,
  isIndexedDBAvailable,
  WebIndexedDBSecureStorageAdapter,
} from "@/lib/finance";

import AccountModal from "@/components/finance/AccountModal";
import TransactionModal from "@/components/finance/TransactionModal";
import TransferModal from "@/components/finance/TransferModal";
import TransactionDetailModal from "@/components/finance/TransactionDetailModal";
import BudgetModal from "@/components/finance/BudgetModal";
import SavingsGoalModal from "@/components/finance/SavingsGoalModal";
import SavingsPocketModal, { PocketModalMode } from "@/components/finance/SavingsPocketModal";
import PocketHistoryModal from "@/components/finance/PocketHistoryModal";
import CategorizationReviewModal from "@/components/finance/CategorizationReviewModal";
import RecurringPaymentsModal from "@/components/finance/RecurringPaymentsModal";
import StatementImportModal from "@/components/finance/StatementImportModal";
import BankIntegrationModal from "@/components/finance/BankIntegrationModal";
import SyncSettingsModal from "@/components/finance/SyncSettingsModal";
import KotakTrackingModal from "@/components/finance/KotakTrackingModal";
import CashFlowChart from "@/components/finance/CashFlowChart";
import CategorySpendingChart from "@/components/finance/CategorySpendingChart";

type DashboardTab = "OVERVIEW" | "TRANSACTIONS" | "BUDGETS" | "GOALS" | "ACCOUNTS";
type PeriodPreset = "THIS_WEEK" | "LAST_6_MONTHS" | "THIS_MONTH" | "LAST_MONTH" | "LAST_3_MONTHS" | "THIS_YEAR" | "ALL_TIME";

export default function FinanceDashboardPage() {
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
  useEffect(()=>{const value=new URLSearchParams(window.location.search).get("section")?.toUpperCase();if(["OVERVIEW","TRANSACTIONS","BUDGETS","GOALS","ACCOUNTS"].includes(value||""))setActiveTab(value as DashboardTab);},[]);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("THIS_WEEK");
  const [isLoading, setIsLoading] = useState(true);

  // Core Data
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryHistory, setCategoryHistory] = useState<Transaction[]>([]);
  const [categoryDrilldown, setCategoryDrilldown] = useState<{start:string;end:string;label:string}|null>(null);
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

  // Savings Pockets State
  const [isPocketModalOpen, setIsPocketModalOpen] = useState(false);
  const [editingPocket, setEditingPocket] = useState<SavingsPocket | null>(null);
  const [pocketModalMode, setPocketModalMode] = useState<PocketModalMode>("create");
  const [historyPocket, setHistoryPocket] = useState<SavingsPocket | null>(null);

  // Phase 3 Modal & Engine State
  const [isCategorizationModalOpen, setIsCategorizationModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [detectedRecurringCount, setDetectedRecurringCount] = useState(0);

  // Phase 4 Modal & Forecast State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [pendingOutboxCount, setPendingOutboxCount] = useState(0);

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

  const pendingFinanceCount = realPendingCount;

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
  const cloudSyncAdapter = useMemo(() => new UnconfiguredCloudSyncAdapter(), []);
  const syncOutboxService = useMemo(() => new SyncOutboxService(uow, cloudSyncAdapter), [uow, cloudSyncAdapter]);
  const notificationTrackingService = useMemo(
    () => new NotificationTrackingService(uow, transactionService, categorizationService),
    [uow, transactionService, categorizationService]
  );
  const secureAdapter = useMemo(() => new WebIndexedDBSecureStorageAdapter(), []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("review") === "1") setIsKotakModalOpen(true);
  }, []);

  // Compute date boundaries based on period preset
  const calendarToday = localFinanceDateKey(new Date());
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let label = "This Month";

    if (periodPreset === "THIS_WEEK") {
      const week = currentFinanceWeek(now);
      start = week.start;
      end = week.todayEnd;
      label = "Current week";
    } else if (periodPreset === "LAST_6_MONTHS") {
      start = new Date(now.getFullYear(),now.getMonth()-5,1);
      label = "Last 6 months";
    } else if (periodPreset === "THIS_MONTH") {
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
  }, [periodPreset, calendarToday]);

  const refreshRequest = React.useRef(0);

  // Main Data Refresh Callback
  const refreshAll = useCallback(async () => {
    const requestId = ++refreshRequest.current;
    const isCurrent = () => requestId === refreshRequest.current;
    if (isCurrent()) setIsLoading(true);
    try {
      if (!isIndexedDBAvailable()) {
        if (isCurrent()) setIsLoading(false);
        return;
      }

      else await new TripFinanceService(uow).reconcile();

      // Ensure system categories exist
      let allCats = await uow.categories.getAll();
      if (allCats.length === 0) {
        await uow.categories.seedDefaults();
        allCats = await uow.categories.getAll();
      }
      if (isCurrent()) setCategories(allCats);

      // Fetch accounts and net worth
      const allAccounts = await uow.accounts.getAll();
      if (isCurrent()) setAccounts(allAccounts);

      const nw = await balanceService.getNetWorth();
      if (isCurrent()) {
        setNetWorthPaise(nw.netWorthPaise);
        syncFinanceWidget({
          balance: formatPaise(nw.netWorthPaise),
          account: allAccounts.length === 1 ? allAccounts[0].name : "Total Net Worth",
          subtext: allAccounts.length === 1 ? "1 active account" : `${allAccounts.length} active accounts`,
          pendingCount: pendingFinanceCount,
        });
      }
      if (isCurrent()) setTotalAssetsPaise(nw.totalAssetsPaise);
      if (isCurrent()) setTotalLiabilitiesPaise(nw.totalLiabilitiesPaise);

      // Fetch period-dependent cash flow and reports
      const flow = await balanceService.getCashFlow(startDate, endDate);
      if (isCurrent()) setPeriodIncomePaise(flow.totalIncomePaise);
      if (isCurrent()) setPeriodExpensePaise(flow.totalExpensesPaise);
      if (isCurrent()) setPeriodNetCashFlowPaise(flow.netCashFlowPaise);

      const timeline = await balanceService.getCashFlowTimeline(startDate, endDate);
      if (isCurrent()) setTimelinePoints(timeline);

      const categoryHistoryStart = new Date(new Date().getFullYear()-1,0,1).toISOString();
      const history = await uow.transactions.query({startDate:categoryHistoryStart,endDate:new Date().toISOString(),direction:"outflow"});
      if (isCurrent()) setCategoryHistory(history);

      // Budgets
      const budgetReport = await budgetService.getCategoryBudgetStatuses(startDate, endDate);
      if (isCurrent()) setBudgets(budgetReport.statuses);

      // Savings Goals
      const goals = await savingsGoalService.getGoalsWithProgress();
      if (isCurrent()) setSavingsGoals(goals);

      // Transactions
      const allTxns = await uow.transactions.query({});
      if (isCurrent()) setTransactions(allTxns);

      // Uncategorized review count
      const uncategorized = await categorizationService.getUncategorizedTransactions();
      if (isCurrent()) setUncategorizedCount(uncategorized.length);

      // Detected subscriptions count
      const detectedRules = await recurringService.getRecurringRules("detected");
      if (isCurrent()) setDetectedRecurringCount(detectedRules.length);

      // Outbox status
      const pendingOps = await uow.outbox.getPending();
      if (isCurrent()) setPendingOutboxCount(pendingOps.length);

      // Kotak Notification Tracking status
      try {
        const trackingStatus = await notificationTrackingService.getStatus();
        if (isCurrent()) setKotakTrackingActive(trackingStatus.enabled && trackingStatus.permissionGranted);
        if (isCurrent()) setKotakReviewCount(trackingStatus.pendingReviewCount);
      } catch {
        // Ignored
      }
    } catch (err) {
      console.error("Failed to load finance data:", err);
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [uow, balanceService, budgetService, savingsGoalService, categorizationService, recurringService, notificationTrackingService, startDate, endDate]);

  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === "visible") {
        notificationTrackingService.drainPendingNotifications().catch(console.warn);
      }
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    const nativeResume = App.addListener("appStateChange", ({ isActive }) => { if (isActive) resume(); });
    (async () => { await notificationTrackingService.initialize(); await refreshAll(); })().catch(console.warn);
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
    window.addEventListener("finance-trips-updated", refresh);
    return () => {window.removeEventListener("finance-notifications-updated", refresh);window.removeEventListener("finance-trips-updated", refresh);};
  }, [refreshAll]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Filtered transactions for the Transactions Tab
  const filteredTransactions = useMemo(() => {
    let result = [...(categoryDrilldown ? categoryHistory : transactions)];
    if(categoryDrilldown) result=result.filter(t=>!t.transferGroupId&&!categories.some(c=>c.id===t.categoryId&&c.type==="transfer")&&Date.parse(t.occurredAt)>=Date.parse(categoryDrilldown.start)&&Date.parse(t.occurredAt)<=Date.parse(categoryDrilldown.end));

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
      result = result.filter((t) => (txnCategoryFilter === "__uncategorized" ? !categories.some(c=>c.id===t.categoryId&&c.type==="expense") : t.categoryId === txnCategoryFilter));
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
  }, [transactions, categoryHistory, categoryDrilldown, categories, txnSearchQuery, txnAccountFilter, txnCategoryFilter, txnStatusFilter, txnSortOrder]);

  const accountPocketSummaries = useMemo(() => {
    const map = new Map<string, {
      recordedBalancePaise: number;
      allocatedPaise: number;
      availableBalancePaise: number;
      shortfallPaise: number;
      activePockets: GoalProgressView[];
    }>();

    for (const acc of accounts) {
      const active = savingsGoals.filter(
        (g) => g.linkedAccountId === acc.id && g.status !== "archived" && !g.isLegacyGoal
      );
      const allocated = active.reduce((sum, g) => sum + (g.allocatedPaise || 0), 0);
      const recorded = acc.currentBalancePaise;
      const available = recorded - allocated;
      const shortfall = available < 0 ? -available : 0;

      map.set(acc.id, {
        recordedBalancePaise: recorded,
        allocatedPaise: allocated,
        availableBalancePaise: available,
        shortfallPaise: shortfall,
        activePockets: active,
      });
    }
    return map;
  }, [accounts, savingsGoals]);

  const tabs = [
    { id: "OVERVIEW", label: "Overview", icon: LayoutDashboard },
    { id: "TRANSACTIONS", label: "Activity", icon: ArrowRightLeft },
    { id: "BUDGETS", label: "Budgets", icon: Tag },
    { id: "GOALS", label: "Pockets", icon: PiggyBank },
    { id: "ACCOUNTS", label: "Accounts", icon: Wallet },
  ] as const;
  const newAccount = () => { setEditingAccount(null); setIsAccountModalOpen(true); };
  const newEntry = () => { setEditingTransaction(null); setIsTransactionModalOpen(true); };
  const accountView = (all = false) => <div className={all ? "af-account-grid" : "af-account-strip"}>
    {(all ? accounts : accounts.filter(a => a.status === "active").slice(0, 4)).map((account, index) => {
      const summary = accountPocketSummaries.get(account.id);
      const isShortfall = !!summary && summary.shortfallPaise > 0;
      const isAllocated = !!summary && summary.allocatedPaise > 0;
      return (
        <article key={account.id} className={`af-account af-account-${index % 3}`}>
          <div className="af-account-top"><span className="af-account-icon">{account.accountType === "credit" ? <CreditCard size={20} /> : <Landmark size={20} />}</span><span>{account.metadata?.institutionName || "ATLAS"} · {account.accountType}{account.status === "archived" ? " · archived" : ""}</span>
            {all && <button aria-label={`Edit ${account.name}`} onClick={() => { setEditingAccount(account); setIsAccountModalOpen(true); }}><Edit3 size={16} /></button>}
          </div>
          <button className="af-account-open" onClick={() => { setTxnAccountFilter(account.id); setActiveTab("TRANSACTIONS"); }}>
            <strong>{account.name}</strong>
            <span className="af-account-number">{account.metadata?.accountNumberLast4 ? `•••• ${account.metadata.accountNumberLast4}` : account.metadata?.institutionName || "Personal account"}</span>
            <b>{formatPaise(summary?.availableBalancePaise ?? account.currentBalancePaise)}</b>
            <span className="af-balance-sublabel">{isAllocated ? "Available to spend" : "Recorded balance"}</span>
            <div className="af-account-breakdown">
              <div className="af-breakdown-row">
                <span>Recorded balance:</span>
                <strong>{formatPaise(account.currentBalancePaise)}</strong>
              </div>
              {isAllocated && (
                <div className="af-breakdown-row">
                  <span>Set aside in pockets:</span>
                  <strong>{formatPaise(summary.allocatedPaise)}</strong>
                </div>
              )}
              {isShortfall && (
                <div className="af-shortfall-alert">
                  <AlertTriangle size={13} />
                  <span>Shortfall: {formatPaise(summary.shortfallPaise)} (Allocations exceed balance)</span>
                </div>
              )}
            </div>
            <span className="glass-card-bottom"><span>ATLAS / RECORDED</span><CreditCard size={20}/></span>
          </button>
          {all && account.status !== "archived" && <button className="af-text-button" onClick={async () => { if (confirm(`Archive ${account.name}? Existing transactions will be kept.`)) { await accountService.archiveAccount(account.id); await refreshAll(); } }}>Archive account</button>}
        </article>
      );
    })}
    {!all && <button className="af-add-account" onClick={newAccount} title="Add a new bank, cash, or credit account"><Plus size={22} /><span>Add account</span></button>}
  </div>;
  const activityView = (items: Transaction[]) => <div className="af-activity-list">{items.length ? items.map(transaction => {
    const category = categories.find(c => c.id === transaction.categoryId);
    const account = accounts.find(a => a.id === transaction.accountId);
    return <button key={transaction.id} className="af-activity-row" onClick={() => setSelectedTxnForDetail(transaction)}>
      <MerchantImage merchant={transaction.merchant || transaction.description} category={category?.name} direction={transaction.direction}/>
      <span className="af-entry-description"><strong>{transaction.description}</strong><small>{transaction.tripAssignment?.tripId && transaction.tripAssignment.mode!=="excluded" ? `Travel & Leisure · ${transaction.tripAssignment.tripTitle}` : category?.name || "Uncategorized"} <span>· {account?.name || "Account"}</span></small></span>
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
        <div className="glass-demo-note"><span>Personal finance</span><Link href="/secret/control-room?tab=cloud">Cloud storage<ArrowUpRight size={13}/></Link></div>
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
              <div className="glass-insights-column"><div className="glass-period"><span>Insights</span></div><CashFlowChart period={periodPreset} onPeriodChange={value=>setPeriodPreset(value as PeriodPreset)} startDate={periodPreset === "ALL_TIME" && timelinePoints.length ? timelinePoints[0].dateKey : startDate} endDate={endDate} periodLabel={periodLabel} timeline={timelinePoints} totalIncomePaise={periodIncomePaise} totalExpensesPaise={periodExpensePaise}/><CategorySpendingChart transactions={categoryHistory} categories={categories} onViewCategory={(id,start,end,label)=>{setTxnCategoryFilter(id);setTxnAccountFilter("ALL");setTxnStatusFilter("posted");setTxnSearchQuery("");setCategoryDrilldown({start,end,label});setActiveTab("TRANSACTIONS");window.scrollTo({top:0});}}/></div>
            </div>
          </>}
          {activeTab !== "OVERVIEW" && <header className="glass-section-title"><p>YOUR FINANCIAL SPACE</p><h2>{activeTab==="ACCOUNTS" ? "Wallet" : activeTab==="TRANSACTIONS" ? "Transactions" : activeTab==="BUDGETS" ? "Spending plan" : "Savings Pockets"}</h2><span>{activeTab === "TRANSACTIONS" && categoryDrilldown ? categoryDrilldown.label : periodLabel}</span></header>}
          {activeTab === "TRANSACTIONS" && <section className="af-section af-paper">{categoryDrilldown && <div className="category-drilldown"><span>{categoryDrilldown.label}</span><button onClick={()=>{setCategoryDrilldown(null);setTxnCategoryFilter("ALL");setTxnStatusFilter("ALL");}}>Clear period</button></div>}<div className="af-filters"><label className="af-search"><Search size={18} /><input aria-label="Search transactions" placeholder="Find a transaction…" value={txnSearchQuery} onChange={e => setTxnSearchQuery(e.target.value)} /></label><FinanceSelect aria-label="Filter account" value={txnAccountFilter} onChange={e => setTxnAccountFilter(e.target.value)}><option value="ALL">All Accounts</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</FinanceSelect><FinanceSelect aria-label="Filter category" value={txnCategoryFilter} onChange={e => {setTxnCategoryFilter(e.target.value);setCategoryDrilldown(null);}}><option value="ALL">All categories</option><option value="__uncategorized">Uncategorized</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</FinanceSelect><FinanceSelect aria-label="Filter status" value={txnStatusFilter} onChange={e => setTxnStatusFilter(e.target.value)}><option value="ALL">Any status</option><option value="posted">Posted</option><option value="pending">Pending</option><option value="reversed">Reversed</option></FinanceSelect></div><div className="af-list-heading"><span>{filteredTransactions.length} transactions</span><FinanceSelect aria-label="Sort transactions" value={txnSortOrder} onChange={e => setTxnSortOrder(e.target.value as typeof txnSortOrder)}><option value="date_desc">Newest first</option><option value="date_asc">Oldest first</option><option value="amount_desc">Highest amount</option><option value="amount_asc">Lowest amount</option></FinanceSelect></div>{activityView(filteredTransactions)}</section>}
          {activeTab === "BUDGETS" && <section className="af-section"><div className="af-section-heading"><h3>Your spending plan</h3><button className="af-primary" onClick={() => { setEditingBudgetId(undefined); setIsBudgetModalOpen(true); }}><Plus size={17} />Create budget</button></div>{budgets.length ? <div className="af-plan-grid">{budgets.map(b => <article className="af-plan" key={b.categoryId}><div className="af-section-heading"><span className="af-plan-icon"><Tag size={21} /></span><button className="af-icon-button" aria-label={`Edit ${b.categoryName} budget`} onClick={() => { setEditingBudgetId(b.categoryId); setIsBudgetModalOpen(true); }}><Edit3 size={17} /></button></div><h3>{b.categoryName}</h3><strong>{formatPaise(b.spentPaise)} <small>of {formatPaise(b.allocatedPaise)}</small></strong><div className={`af-progress ${b.isOverBudget ? "is-over" : ""}`} role="progressbar" aria-label={b.categoryName} aria-valuenow={Math.min(100,b.percentageUsed)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100,Math.max(0,b.percentageUsed))}%` }} /></div><p>{b.isOverBudget ? `${formatPaise(Math.abs(b.remainingPaise))} over your plan` : `${formatPaise(b.remainingPaise)} left to spend`}</p></article>)}</div> : <div className="af-empty af-empty-large"><Tag size={36} /><h3>Spend with a plan.</h3><p>Create category limits to see what’s available before you spend.</p><button className="af-primary" onClick={() => setIsBudgetModalOpen(true)}>Create your first budget</button></div>}</section>}
          {activeTab === "GOALS" && (
            <section className="af-section">
              <div className="af-section-heading">
                <div>
                  <h3>Savings Pockets</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Money stays in your account. Atlas tracks what you’ve set aside.
                  </p>
                </div>
                <button
                  className="af-primary"
                  onClick={() => {
                    setEditingPocket(null);
                    setPocketModalMode("create");
                    setIsPocketModalOpen(true);
                  }}
                >
                  <Plus size={17} />New pocket
                </button>
              </div>

              {/* Account summary strip */}
              {accounts.filter(a => a.status === "active" && (a.accountType === "bank" || a.accountType === "cash" || a.accountType === "savings")).length > 0 && (
                <div className="af-pocket-account-strip">
                  {accounts
                    .filter(a => a.status === "active" && (a.accountType === "bank" || a.accountType === "cash" || a.accountType === "savings"))
                    .map(acc => {
                      const s = accountPocketSummaries.get(acc.id);
                      const isShortfall = !!s && s.shortfallPaise > 0;
                      return (
                        <div key={acc.id} className={`af-pocket-acc-card ${isShortfall ? "has-shortfall" : ""}`}>
                          <div className="af-pocket-acc-name">
                            <Landmark size={14} />
                            <span>{acc.name}</span>
                          </div>
                          <div className="af-pocket-acc-nums">
                            <span>Recorded: <b>{formatPaise(acc.currentBalancePaise)}</b></span>
                            <span>Set aside: <b className="text-emerald-500">{formatPaise(s?.allocatedPaise || 0)}</b></span>
                            <span className={isShortfall ? "text-rose-500 font-semibold" : ""}>
                              {isShortfall ? `Shortfall: -${formatPaise(s.shortfallPaise)}` : `Available: ${formatPaise(s?.availableBalancePaise ?? acc.currentBalancePaise)}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Active Pockets Grid */}
              {savingsGoals.filter(g => !g.isLegacyGoal && g.status !== "archived").length > 0 ? (
                <div className="af-plan-grid">
                  {savingsGoals
                    .filter(g => !g.isLegacyGoal && g.status !== "archived")
                    .map(pocket => {
                      const linkedAccount = accounts.find(a => a.id === pocket.linkedAccountId);
                      return (
                        <article className="af-plan af-goal" key={pocket.id} style={{ borderTop: `3px solid ${pocket.color || "#10B981"}` }}>
                          <div className="af-section-heading">
                            <span className="af-goal-symbol" style={{ color: pocket.color || "#10B981" }}>
                              <PiggyBank size={25} />
                            </span>
                            <span className="af-tag">{linkedAccount?.name || "Account linked"}</span>
                          </div>
                          <span className="glass-goal-label">SAVINGS POCKET</span>
                          <h3>{pocket.name}</h3>
                          <strong>{formatPaise(pocket.allocatedPaise || 0)}</strong>
                          {pocket.targetAmountPaise ? (
                            <>
                              <p>of {formatPaise(pocket.targetAmountPaise)} ({pocket.percentComplete}% target)</p>
                              <div className="af-progress" role="progressbar" aria-label={pocket.name} aria-valuenow={pocket.percentComplete} aria-valuemin={0} aria-valuemax={100}>
                                <i style={{ width: `${Math.min(100, pocket.percentComplete)}%`, background: pocket.color || undefined }} />
                              </div>
                            </>
                          ) : (
                            <p className="text-muted-foreground text-xs">Flexible pocket (no target)</p>
                          )}
                          {pocket.targetDate && (
                            <small className="text-muted-foreground block text-[11px] mt-2">
                              Target date: {new Date(pocket.targetDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </small>
                          )}
                          <div className="af-goal-actions">
                            <button
                              className="af-primary"
                              onClick={() => {
                                setEditingPocket(pocket);
                                setPocketModalMode("allocate");
                                setIsPocketModalOpen(true);
                              }}
                            >
                              Set aside
                            </button>
                            <button
                              className="af-secondary-btn"
                              onClick={() => {
                                setEditingPocket(pocket);
                                setPocketModalMode("release");
                                setIsPocketModalOpen(true);
                              }}
                            >
                              Release
                            </button>
                            <button
                              className="af-icon-button"
                              aria-label={`Move allocation from ${pocket.name}`}
                              title="Move allocation"
                              onClick={() => {
                                setEditingPocket(pocket);
                                setPocketModalMode("move");
                                setIsPocketModalOpen(true);
                              }}
                            >
                              <ArrowRightLeft size={16} />
                            </button>
                            <button
                              className="af-icon-button"
                              aria-label={`View history for ${pocket.name}`}
                              title="History"
                              onClick={() => setHistoryPocket(pocket)}
                            >
                              <History size={16} />
                            </button>
                            <button
                              className="af-icon-button"
                              aria-label={`Edit ${pocket.name}`}
                              title="Edit pocket"
                              onClick={() => {
                                setEditingPocket(pocket);
                                setPocketModalMode("edit");
                                setIsPocketModalOpen(true);
                              }}
                            >
                              <Edit3 size={16} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                </div>
              ) : savingsGoals.filter(g => g.isLegacyGoal).length === 0 ? (
                <div className="af-empty af-empty-large">
                  <PiggyBank size={36} />
                  <h3>Put money aside for what matters.</h3>
                  <p>Set aside small amounts (₹50, ₹100, ₹500) from your bank or cash accounts without locking funds or changing your net worth.</p>
                  <p className="text-xs text-muted-foreground mt-1">“Money stays in your account. Atlas tracks what you’ve set aside.”</p>
                  <button
                    className="af-primary"
                    onClick={() => {
                      setEditingPocket(null);
                      setPocketModalMode("create");
                      setIsPocketModalOpen(true);
                    }}
                  >
                    Create your first pocket
                  </button>
                </div>
              ) : null}

              {/* Legacy Goals Section */}
              {savingsGoals.filter(g => g.isLegacyGoal).length > 0 && (
                <div className="af-legacy-goals-section">
                  <div className="af-section-heading">
                    <div>
                      <h3>Legacy Tracked Goals</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Existing Savings Goals contain manually entered progress that does not represent reserved account funds. Choose an account whenever you want to allocate funds.
                      </p>
                    </div>
                  </div>
                  <div className="af-plan-grid">
                    {savingsGoals
                      .filter(g => g.isLegacyGoal)
                      .map(g => (
                        <article className="af-plan af-goal af-legacy-goal" key={g.id}>
                          <div className="af-section-heading">
                            <span className="af-goal-symbol"><Target size={24} /></span>
                            <span className="af-tag af-tag-legacy">Legacy Tracked</span>
                          </div>
                          <span className="glass-goal-label">MANUAL GOAL</span>
                          <h3>{g.name}</h3>
                          <strong>{formatPaise(g.legacyTrackedPaise || g.currentAmountPaise || 0)}</strong>
                          {g.targetAmountPaise ? (
                            <p>of {formatPaise(g.targetAmountPaise)} ({g.percentComplete}%)</p>
                          ) : null}
                          <div className="af-legacy-badge">
                            <span>Not reserved from any account</span>
                          </div>
                          <div className="af-goal-actions">
                            <button
                              className="af-primary"
                              onClick={() => {
                                setEditingPocket(g);
                                setPocketModalMode("migrate_legacy");
                                setIsPocketModalOpen(true);
                              }}
                            >
                              Choose account &amp; allocate
                            </button>
                            <button
                              className="af-icon-button"
                              aria-label={`Edit ${g.name}`}
                              title="Edit goal"
                              onClick={() => {
                                setEditingPocket(g);
                                setPocketModalMode("edit");
                                setIsPocketModalOpen(true);
                              }}
                            >
                              <Edit3 size={16} />
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                </div>
              )}
            </section>
          )}
          {activeTab === "ACCOUNTS" && <section className="af-section"><div className="af-section-heading"><h3>One place for every balance</h3><button className="af-primary" onClick={newAccount}><Plus size={17} />Add account</button></div>{accounts.length ? accountView(true) : <div className="af-empty af-empty-large"><Wallet size={36} /><h3>Let’s bring your money together.</h3><p>Add an account to start tracking balances and payments.</p><button className="af-primary" onClick={newAccount}>Add account</button></div>}</section>}
          <TripFinancePanel uow={uow} transactionService={transactionService} accounts={accounts} categories={categories} onChange={refreshAll} showCards={activeTab==="OVERVIEW"}/>
          <details className="af-utility-section"><summary>More ways to manage your money <Plus size={17}/></summary><div className="af-section-heading"><h3>Make Finance work for you</h3><span className="af-eyebrow">YOUR TOOLKIT</span></div><div className="af-utility-grid">{[
            {label:"Bank messages",description:kotakTrackingActive ? "Capture is on · review your inbox" : "Capture, categorise, approve",icon:BellRing,action:()=>setIsKotakModalOpen(true),count:pendingFinanceCount},
            {label:"Trip spending",description:"Trips, advance bookings and travel budgets",icon:Wallet,action:()=>window.dispatchEvent(new Event("open-finance-trips"))},
            {label:"Import a statement",description:"Bring your past payments along",icon:FileUp,action:()=>setIsImportModalOpen(true)},
            {label:"Bills & subscriptions",description:`${detectedRecurringCount || "Review"} recurring payments`,icon:Repeat,action:()=>setIsRecurringModalOpen(true)},
            {label:"Category rules",description:`${uncategorizedCount} transactions to organise`,icon:Sparkles,action:()=>setIsCategorizationModalOpen(true)},
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
        pockets={savingsGoals}
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
        pockets={savingsGoals}
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

      <SavingsPocketModal
        isOpen={isPocketModalOpen}
        onClose={() => {
          setIsPocketModalOpen(false);
          setEditingPocket(null);
        }}
        onSuccess={refreshAll}
        savingsGoalService={savingsGoalService}
        accounts={accounts}
        allPockets={savingsGoals}
        editingPocket={editingPocket}
        mode={pocketModalMode}
      />

      <PocketHistoryModal
        isOpen={!!historyPocket}
        onClose={() => setHistoryPocket(null)}
        pocket={historyPocket}
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
