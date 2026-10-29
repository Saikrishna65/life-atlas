"use client";
import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  Search,
  X,
  PieChart,
  Receipt,
  Car,
  Home,
  Utensils,
  Fuel,
  Ticket,
  ShoppingBag,
  HeartPulse,
  MoreHorizontal,
  Users,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { useExpenses, ALL_EXPENSE_CATEGORIES } from "@/lib/vault/useExpenses";
import {
  ExpenseRecord,
  ExpenseCategory,
  PaymentMode,
  DepositRefundStatus,
} from "@/lib/vault/types";
import { Select } from "@/components/ui/Select";
import { useLockBodyScroll } from "@/lib/vault/useLockBodyScroll";

type ViewTab = "LOG" | "ALLOCATION" | "DEPOSITS";
type CategoryFilter = "ALL" | ExpenseCategory;

export default function TripBudgetPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const {
    trip,
    expenses,
    stats,
    isLoading,
    addExpense,
    updateExpense,
    removeExpense,
    updateCategoryBudgets,
    updateDepositRefund,
  } = useExpenses(tripId);

  // View state
  const [activeTab, setActiveTab] = useState<ViewTab>("LOG");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [refundModalExpense, setRefundModalExpense] = useState<ExpenseRecord | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState<string>("");
  const [refundStatusInput, setRefundStatusInput] = useState<DepositRefundStatus>("REFUNDED");

  // Add/Edit Form State
  const [formTitle, setFormTitle] = useState("");
  const [formAmount, setFormAmount] = useState<string>("");
  const [formCategory, setFormCategory] = useState<ExpenseCategory>("FOOD");
  const [formPaidBy, setFormPaidBy] = useState("Self");
  const [formPaymentMode, setFormPaymentMode] = useState<PaymentMode>("UPI");
  const [formDate, setFormDate] = useState("");
  const [formIsDeposit, setFormIsDeposit] = useState(false);
  const [formDepositStatus, setFormDepositStatus] = useState<DepositRefundStatus>("PENDING");
  const [formSplitWith, setFormSplitWith] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Allocation Form State
  const [allocations, setAllocations] = useState<Partial<Record<ExpenseCategory, number>>>({});

  // Lock body scroll when any modal is open
  useLockBodyScroll(showAddModal || showAllocationModal || !!refundModalExpense);

  // Open Allocation modal with current values
  const handleOpenAllocationModal = () => {
    setAllocations(trip?.categoryBudgets || {});
    setShowAllocationModal(true);
  };

  // Open Add modal with smart defaults
  const handleOpenAddModal = (presetCategory: ExpenseCategory = "FOOD") => {
    setEditingExpense(null);
    setFormTitle("");
    setFormAmount("");
    setFormCategory(presetCategory);
    setFormPaidBy("Self");
    setFormPaymentMode("UPI");
    setFormDate(new Date().toISOString().slice(0, 16));
    setFormIsDeposit(false);
    setFormDepositStatus("PENDING");
    setFormSplitWith(trip?.companions?.join(", ") || "");
    setFormNotes("");
    setShowAddModal(true);
  };

  // Open Edit modal
  const handleOpenEditModal = (exp: ExpenseRecord) => {
    setEditingExpense(exp);
    setFormTitle(exp.title);
    setFormAmount(String(exp.amount));
    setFormCategory(exp.category);
    setFormPaidBy(exp.paidBy);
    setFormPaymentMode(exp.paymentMode);
    setFormDate(exp.date ? exp.date.slice(0, 16) : new Date().toISOString().slice(0, 16));
    setFormIsDeposit(exp.isDeposit);
    setFormDepositStatus(exp.depositRefundStatus || "PENDING");
    setFormSplitWith(exp.splitWith ? exp.splitWith.join(", ") : "");
    setFormNotes(exp.notes || "");
    setShowAddModal(true);
  };

  // Open Refund settlement modal
  const handleOpenRefundModal = (exp: ExpenseRecord) => {
    setRefundModalExpense(exp);
    setRefundAmountInput(String(exp.amount));
    setRefundStatusInput("REFUNDED");
  };

  // Handle Submit Expense Form
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formAmount.trim()) return;

    setIsSubmitting(true);
    try {
      const amt = parseFloat(formAmount);
      const splitArr = formSplitWith
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const d = formDate ? new Date(formDate).toISOString() : new Date().toISOString();

      if (editingExpense) {
        await updateExpense({
          ...editingExpense,
          title: formTitle.trim(),
          amount: amt,
          category: formCategory,
          paidBy: formPaidBy.trim() || "Self",
          paymentMode: formPaymentMode,
          date: d,
          isDeposit: formIsDeposit,
          depositRefundStatus: formIsDeposit ? formDepositStatus : undefined,
          splitWith: splitArr.length > 0 ? splitArr : undefined,
          notes: formNotes.trim() || undefined,
        });
      } else {
        await addExpense({
          title: formTitle.trim(),
          amount: amt,
          currency: trip?.currency || "INR",
          category: formCategory,
          paidBy: formPaidBy.trim() || "Self",
          paymentMode: formPaymentMode,
          date: d,
          isDeposit: formIsDeposit,
          depositRefundStatus: formIsDeposit ? formDepositStatus : undefined,
          splitWith: splitArr.length > 0 ? splitArr : undefined,
          notes: formNotes.trim() || undefined,
        });
      }
      setShowAddModal(false);
      setEditingExpense(null);
    } catch (err) {
      console.error("Failed saving expense:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save Allocations
  const handleSaveAllocations = async () => {
    setIsSubmitting(true);
    try {
      await updateCategoryBudgets(allocations);
      setShowAllocationModal(false);
    } catch (err) {
      console.error("Failed updating category budgets:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save Refund Settlement
  const handleSaveRefund = async () => {
    if (!refundModalExpense) return;
    try {
      const amt = refundAmountInput ? parseFloat(refundAmountInput) : refundModalExpense.amount;
      await updateDepositRefund(refundModalExpense.id, refundStatusInput, amt);
      setRefundModalExpense(null);
    } catch (err) {
      console.error("Failed saving deposit refund:", err);
    }
  };

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (categoryFilter !== "ALL" && exp.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = exp.title.toLowerCase().includes(q);
        const matchesNotes = exp.notes?.toLowerCase().includes(q);
        const matchesPaidBy = exp.paidBy.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNotes && !matchesPaidBy) return false;
      }
      return true;
    });
  }, [expenses, categoryFilter, searchQuery]);

  // Category Icon & Styling Helper
  const getCategoryDetails = (cat: ExpenseCategory) => {
    switch (cat) {
      case "TRANSPORT":
        return { label: "Transport & Tickets", icon: <Car className="w-3.5 h-3.5 text-cyan-700" />, badge: "bg-cyan-50 text-cyan-800 border-cyan-200" };
      case "ACCOMMODATION":
        return { label: "Stays & Hotels", icon: <Home className="w-3.5 h-3.5 text-indigo-700" />, badge: "bg-indigo-50 text-indigo-800 border-indigo-200" };
      case "FOOD":
        return { label: "Food & Cafes", icon: <Utensils className="w-3.5 h-3.5 text-orange-700" />, badge: "bg-orange-50 text-orange-800 border-orange-200" };
      case "RENTAL":
        return { label: "Bike / Car Rentals", icon: <CreditCard className="w-3.5 h-3.5 text-emerald-700" />, badge: "bg-emerald-50 text-emerald-800 border-emerald-200" };
      case "FUEL":
        return { label: "Fuel & Jerry Cans", icon: <Fuel className="w-3.5 h-3.5 text-amber-700" />, badge: "bg-amber-50 text-amber-800 border-amber-200" };
      case "ACTIVITIES":
        return { label: "Activities & Entry", icon: <Ticket className="w-3.5 h-3.5 text-teal-700" />, badge: "bg-teal-50 text-teal-800 border-teal-200" };
      case "PERMITS":
        return { label: "Permits & Tolls", icon: <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />, badge: "bg-blue-50 text-blue-800 border-blue-200" };
      case "SHOPPING":
        return { label: "Gear & Souvenirs", icon: <ShoppingBag className="w-3.5 h-3.5 text-purple-700" />, badge: "bg-purple-50 text-purple-800 border-purple-200" };
      case "EMERGENCY":
        return { label: "Medical & Repairs", icon: <HeartPulse className="w-3.5 h-3.5 text-rose-700" />, badge: "bg-rose-50 text-rose-800 border-rose-200" };
      default:
        return { label: "Miscellaneous", icon: <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />, badge: "bg-surface border-muted text-foreground" };
    }
  };

  // Currency symbol
  const curr = trip?.currency || "INR";

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
        <div className="w-4 h-4 rounded-full border border-muted border-t-rose-500 animate-spin" />
        <span>Loading offline financial ledger & budget...</span>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center mx-auto">
          <CreditCard className="w-6 h-6 text-rose-600" />
        </div>
        <h2 className="font-display text-2xl text-foreground font-normal">
          Expedition Dossier Not Found
        </h2>
        <Link
          href="/secret/vault"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-muted text-xs font-sans text-foreground"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pt-2 sm:pt-4 pb-24">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between border-b border-muted pb-4">
        <Link
          href={`/secret/vault/${trip.id}`}
          className="group inline-flex items-center gap-2 text-xs font-sans tracking-wide text-muted-foreground hover:text-foreground transition-colors py-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Command Center</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-[11px] font-mono tracking-wider text-rose-700 font-semibold uppercase">
            <CreditCard className="w-3 h-3 text-rose-600" />
            <span>Budget & Expenses</span>
          </div>
        </div>
      </nav>

      {/* FINANCIAL RADAR / HERO BUDGET BANNER */}
      <section className="relative rounded-3xl border border-muted bg-surface overflow-hidden shadow-soft p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[10px] font-mono text-rose-700 uppercase tracking-widest font-semibold">
              <PieChart className="w-3 h-3 text-rose-600" />
              <span>Expenditure Telemetry</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-foreground font-normal tracking-tight">
              Budget Planning & Expenses
            </h1>
            <p className="font-body text-xs text-muted-foreground max-w-xl leading-relaxed">
              Track multi-mode expenditures, category budget progress, companion splits, and refundable security deposit recovery for{" "}
              <span className="text-foreground font-medium">{trip.destination}</span>.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleOpenAddModal("FOOD")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-medium text-xs font-sans transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Log Expense</span>
            </button>

            <button
              onClick={handleOpenAllocationModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-surface border border-muted hover:border-accent text-xs font-sans text-foreground transition-colors shadow-xs"
            >
              <PieChart className="w-3.5 h-3.5 text-rose-600" />
              <span>Allocate Budget</span>
            </button>
          </div>
        </div>

        {/* FINANCIAL SUMMARY METRICS RIBBON */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-muted">
          {/* Metric 1: Total Budget */}
          <div className="p-3.5 rounded-2xl bg-background border border-muted">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Expedition Budget
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold font-mono text-foreground">
                {curr} {stats.totalBudget.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Target spending limit
            </span>
          </div>

          {/* Metric 2: Total Spent */}
          <div className="p-3.5 rounded-2xl bg-background border border-muted">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Actual Spent
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-xl font-bold font-mono ${
                  stats.isOverBudget ? "text-rose-700" : "text-foreground"
                }`}
              >
                {curr} {stats.totalSpent.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                ({stats.percentSpent}%)
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.isOverBudget
                    ? "bg-rose-500"
                    : stats.percentSpent > 80
                    ? "bg-amber-500"
                    : "bg-emerald-600"
                }`}
                style={{ width: `${Math.min(stats.percentSpent, 100)}%` }}
              />
            </div>
          </div>

          {/* Metric 3: Remaining Budget */}
          <div className="p-3.5 rounded-2xl bg-background border border-muted">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Remaining Balance
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-xl font-bold font-mono ${
                  stats.remainingBudget < 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                {curr} {stats.remainingBudget.toLocaleString()}
              </span>
            </div>
            <span
              className={`text-[10px] block mt-0.5 ${
                stats.remainingBudget < 0 ? "text-rose-700 font-semibold" : "text-emerald-700 font-medium"
              }`}
            >
              {stats.remainingBudget < 0 ? "⚠️ Over-budget limit" : "Safe liquidity balance"}
            </span>
          </div>

          {/* Metric 4: Pending Deposits Recovery */}
          <div className="p-3.5 rounded-2xl bg-background border border-muted">
            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
              Pending Deposits
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold font-mono text-cyan-800">
                {curr} {stats.pendingRefundAmount.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              {stats.depositLedger.length} deposit records held
            </span>
          </div>
        </div>
      </section>

      {/* VIEW TABS & FILTERS */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Segmented View Tabs */}
          <div className="flex items-center p-1 rounded-2xl bg-surface border border-muted text-xs font-sans">
            <button
              onClick={() => setActiveTab("LOG")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "LOG"
                  ? "bg-accent text-accent-foreground font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Expenses Log ({expenses.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("ALLOCATION")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "ALLOCATION"
                  ? "bg-accent text-accent-foreground font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>Category Allocation</span>
            </button>

            <button
              onClick={() => setActiveTab("DEPOSITS")}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "DEPOSITS"
                  ? "bg-accent text-accent-foreground font-medium shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Deposit Ledger ({stats.depositLedger.length})</span>
            </button>
          </div>

          {/* Search Input (Active on LOG view) */}
          {activeTab === "LOG" && (
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expense, note, paid by..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-surface border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Category Filter Pills (When LOG active) */}
        {activeTab === "LOG" && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-sans">
            <button
              onClick={() => setCategoryFilter("ALL")}
              className={`px-2.5 py-1 rounded-xl border transition-colors ${
                categoryFilter === "ALL"
                  ? "bg-accent text-accent-foreground border-accent font-medium"
                  : "bg-surface border-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All Categories
            </button>
            {ALL_EXPENSE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-xl border transition-colors ${
                  categoryFilter === cat
                    ? "bg-accent text-accent-foreground border-accent font-medium"
                    : "bg-surface border-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* TAB 1: EXPENSES LOG (REQ-BDG-02) */}
      {activeTab === "LOG" && (
        <section className="space-y-3">
          {filteredExpenses.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-muted bg-surface/40 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="font-display text-base text-foreground font-normal">
                No Expenses Logged Yet
              </h3>
              <p className="font-body text-xs text-muted-foreground max-w-sm mx-auto">
                Record your daily fuel bills, dhaba meals, hotel payments, entry tickets, and equipment rentals to keep full financial control.
              </p>
              <button
                onClick={() => handleOpenAddModal("FOOD")}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-medium shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Log First Expense</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {filteredExpenses.map((exp) => {
                const cat = getCategoryDetails(exp.category);

                return (
                  <div
                    key={exp.id}
                    className="rounded-2xl border border-muted hover:border-accent bg-surface shadow-soft p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2.5 rounded-xl bg-background border border-muted shrink-0 mt-0.5">
                        {cat.icon}
                      </div>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-display text-base font-normal text-foreground">
                            {exp.title}
                          </h4>

                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-sans border ${cat.badge}`}>
                            {cat.label}
                          </span>

                          <span className="px-1.5 py-0.5 rounded bg-background border border-muted text-[10px] font-mono text-muted-foreground">
                            {exp.paymentMode}
                          </span>

                          {exp.isDeposit && (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${
                                exp.depositRefundStatus === "REFUNDED"
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                  : exp.depositRefundStatus === "PENDING"
                                  ? "bg-amber-50 border-amber-200 text-amber-800"
                                  : "bg-rose-50 border-rose-200 text-rose-800"
                              }`}
                            >
                              Deposit: {exp.depositRefundStatus}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs font-sans text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span>{new Date(exp.date).toLocaleDateString()}</span>
                          </span>

                          <span>•</span>
                          <span>Paid by <strong className="text-foreground">{exp.paidBy}</strong></span>

                          {exp.splitWith && exp.splitWith.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3 text-cyan-700" />
                                <span>Split: {exp.splitWith.join(", ")}</span>
                              </span>
                            </>
                          )}
                        </div>

                        {exp.notes && (
                          <p className="text-xs font-sans text-muted-foreground leading-relaxed pt-0.5 italic">
                            &ldquo;{exp.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Amount & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-muted/50">
                      <div className="text-right">
                        <span className="text-base sm:text-lg font-bold font-mono text-foreground block">
                          {exp.currency} {exp.amount.toLocaleString()}
                        </span>
                        {exp.isDeposit && exp.depositRefundStatus === "REFUNDED" && (
                          <span className="text-[10px] font-mono text-emerald-700 block">
                            (Refunded: {exp.currency} {(exp.refundAmount || exp.amount).toLocaleString()})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {exp.isDeposit && exp.depositRefundStatus === "PENDING" && (
                          <button
                            onClick={() => handleOpenRefundModal(exp)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[11px] font-sans font-medium text-emerald-800 transition-colors"
                            title="Settle Deposit Refund"
                          >
                            Settle Refund
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEditModal(exp)}
                          className="p-1.5 rounded-lg border border-muted hover:border-foreground/30 text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit Expense"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => removeExpense(exp.id)}
                          className="p-1.5 rounded-lg border border-muted hover:border-rose-500/40 text-muted-foreground hover:text-rose-600 transition-colors"
                          title="Delete Expense"
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
        </section>
      )}

      {/* TAB 2: CATEGORY BUDGET ALLOCATION (REQ-BDG-01) */}
      {activeTab === "ALLOCATION" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg text-foreground font-normal tracking-tight">
                Category Budget Allocation
              </h3>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                Spending vs target quota for each expedition category.
              </p>
            </div>

            <button
              onClick={handleOpenAllocationModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-muted hover:border-accent text-xs font-sans text-foreground transition-colors"
            >
              <Edit3 className="w-3 h-3 text-rose-600" />
              <span>Configure Quotas</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {ALL_EXPENSE_CATEGORIES.map((catKey) => {
              const detail = stats.byCategory[catKey];
              const cat = getCategoryDetails(catKey);
              const allocated = detail.allocated;
              const spent = detail.spent;
              const percent = detail.percent;
              const isOver = detail.isOver;

              return (
                <div
                  key={catKey}
                  className={`rounded-2xl border p-4 shadow-soft space-y-3 transition-all ${
                    isOver
                      ? "border-rose-300 bg-rose-50/50"
                      : "border-muted bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-background border border-muted">
                        {cat.icon}
                      </div>
                      <div>
                        <h4 className="font-display text-sm font-normal text-foreground">
                          {cat.label}
                        </h4>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground">
                          {catKey}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-bold font-mono text-foreground block">
                        {curr} {spent.toLocaleString()}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground block">
                        of {curr} {allocated > 0 ? allocated.toLocaleString() : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isOver
                            ? "bg-rose-500"
                            : percent > 85
                            ? "bg-amber-500"
                            : "bg-emerald-600"
                        }`}
                        style={{ width: `${allocated > 0 ? Math.min(percent, 100) : 0}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className={isOver ? "text-rose-700 font-bold" : "text-muted-foreground"}>
                        {allocated > 0 ? `${percent}% of allocated` : "No quota defined"}
                      </span>
                      {isOver && (
                        <span className="text-rose-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Over by {curr} {(spent - allocated).toLocaleString()}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 3: REFUNDABLE DEPOSIT LEDGER (REQ-BDG-03) */}
      {activeTab === "DEPOSITS" && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg text-foreground font-normal tracking-tight">
                Refundable Security Deposit Recovery Dashboard
              </h3>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                Track pending security deposits from bike rentals, hotels, and gear vendors until full reimbursement.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-800 bg-cyan-50 px-3 py-1 rounded-xl border border-cyan-200">
                Pending Recovery: {curr} {stats.pendingRefundAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {stats.depositLedger.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-muted bg-surface/40 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-200 text-cyan-700 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="font-display text-base text-foreground font-normal">
                No Security Deposits on File
              </h4>
              <p className="font-body text-xs text-muted-foreground max-w-sm mx-auto">
                When logging bike rentals, hotel advances, or camping gear deposits, check &ldquo;Refundable Security Deposit&rdquo; to track reimbursement here.
              </p>
              <button
                onClick={() => {
                  handleOpenAddModal("RENTAL");
                  setFormIsDeposit(true);
                  setFormTitle("Bike Rental Security Deposit");
                  setFormAmount("5000");
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent text-accent-foreground text-xs font-medium shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Security Deposit</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {stats.depositLedger.map((dep) => {
                const isPending = dep.depositRefundStatus === "PENDING";
                const isRefunded = dep.depositRefundStatus === "REFUNDED";

                return (
                  <div
                    key={dep.id}
                    className={`rounded-2xl border p-4 sm:p-5 shadow-soft transition-all space-y-3 ${
                      isPending
                        ? "border-amber-300 bg-amber-50/20"
                        : isRefunded
                        ? "border-emerald-300 bg-emerald-50/20"
                        : "border-rose-300 bg-rose-50/20"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-display text-base sm:text-lg font-normal text-foreground">
                            {dep.title}
                          </h4>

                          <span
                            className={`px-2.5 py-0.5 rounded-md font-mono text-[10px] uppercase font-bold border ${
                              isRefunded
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                : isPending
                                ? "bg-amber-50 border-amber-200 text-amber-800"
                                : "bg-rose-50 border-rose-200 text-rose-800"
                            }`}
                          >
                            {dep.depositRefundStatus}
                          </span>

                          <span className="px-2 py-0.5 rounded bg-background border border-muted text-[10px] font-mono text-muted-foreground">
                            {dep.paymentMode}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs font-sans text-muted-foreground">
                          <span>Deposit Date: {new Date(dep.date).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>Paid by: {dep.paidBy}</span>
                          <span>•</span>
                          <span>Category: {dep.category}</span>
                        </div>

                        {dep.notes && (
                          <p className="text-xs font-sans text-muted-foreground leading-relaxed pt-1">
                            {dep.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                        <div className="text-right">
                          <span className="text-lg font-bold font-mono text-amber-800 block">
                            {dep.currency} {dep.amount.toLocaleString()}
                          </span>
                          {isRefunded && (
                            <span className="text-[10px] font-mono text-emerald-700 block">
                              Refunded: {dep.currency} {(dep.refundAmount || dep.amount).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {isPending ? (
                          <button
                            onClick={() => handleOpenRefundModal(dep)}
                            className="px-3 py-1.5 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground font-medium text-xs font-sans transition-all shadow-xs"
                          >
                            Mark Refunded
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenRefundModal(dep)}
                            className="px-2.5 py-1.5 rounded-xl bg-surface hover:bg-surface-hover border border-muted text-xs font-sans text-muted-foreground transition-colors"
                          >
                            Edit Settlement
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ADD / EDIT EXPENSE MODAL */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAddModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-600" />
                <h3 className="font-display text-xl text-foreground font-normal">
                  {editingExpense ? "Edit Expense" : "Log Expense"}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} className="space-y-4">
              {/* Title & Amount */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Expense Title *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Tandi Petrol Fill, Keylong Homestay Dinner, Rohtang Permit"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-sm text-foreground placeholder:text-muted-foreground/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Amount ({curr}) *</label>
                  <input
                    type="number"
                    step="any"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-sm font-mono text-foreground"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Category *</label>
                  <Select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                    options={ALL_EXPENSE_CATEGORIES.map((c) => ({
                      value: c,
                      label: c,
                    }))}
                  />
                </div>
              </div>

              {/* Payment Mode & Paid By */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Payment Mode</label>
                  <Select
                    value={formPaymentMode}
                    onChange={(e) => setFormPaymentMode(e.target.value as PaymentMode)}
                    options={[
                      { value: "UPI", label: "UPI (GPay / PhonePe / Paytm)" },
                      { value: "CASH", label: "Cash" },
                      { value: "CARD", label: "Debit / Credit Card" },
                      { value: "NET_BANKING", label: "Net Banking" },
                      { value: "OTHER", label: "Other" },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Paid By</label>
                  <input
                    type="text"
                    value={formPaidBy}
                    onChange={(e) => setFormPaidBy(e.target.value)}
                    placeholder="e.g. Self, Rohit, Priya"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground"
                  />
                </div>
              </div>

              {/* Date & Split */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Expense Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">Split With (Companions)</label>
                  <input
                    type="text"
                    value={formSplitWith}
                    onChange={(e) => setFormSplitWith(e.target.value)}
                    placeholder="e.g. Rahul, Sneha (comma-separated)"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* Refundable Deposit Checkbox */}
              <div className="p-3 rounded-xl bg-background border border-muted space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsDeposit}
                    onChange={(e) => setFormIsDeposit(e.target.checked)}
                    className="rounded border-muted text-accent focus:ring-accent"
                  />
                  <span className="text-xs font-sans font-medium text-foreground">
                    This is a Refundable Security Deposit
                  </span>
                </label>

                {formIsDeposit && (
                  <div className="pt-2 border-t border-muted/50 space-y-1">
                    <label className="text-[11px] font-sans text-muted-foreground">Refund Status</label>
                    <Select
                      value={formDepositStatus}
                      onChange={(e) => setFormDepositStatus(e.target.value as DepositRefundStatus)}
                      options={[
                        { value: "PENDING", label: "Pending Refund on Return" },
                        { value: "REFUNDED", label: "Refunded & Settled" },
                        { value: "DEDUCTED", label: "Deductions Applied" },
                      ]}
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Notes / Memo</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Paid cash at remote dhaba without mobile connectivity."
                  className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs text-foreground placeholder:text-muted-foreground/50 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-muted hover:bg-surface-hover text-xs font-sans text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-50 text-accent-foreground font-medium text-xs font-sans transition-all"
                >
                  {isSubmitting ? "Saving..." : editingExpense ? "Update Expense" : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIGURE CATEGORY ALLOCATIONS MODAL (REQ-BDG-01) */}
      {showAllocationModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAllocationModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-rose-600" />
                <h3 className="font-display text-xl text-foreground font-normal">
                  Configure Category Budgets
                </h3>
              </div>
              <button
                onClick={() => setShowAllocationModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-sans text-muted-foreground">
              Allocate target spending limits across categories. Overall Trip Budget:{" "}
              <strong className="text-foreground">{curr} {trip.budgetTotal.toLocaleString()}</strong>.
            </p>

            <div className="space-y-3">
              {ALL_EXPENSE_CATEGORIES.map((catKey) => {
                const currentVal = allocations[catKey] || 0;

                return (
                  <div key={catKey} className="flex items-center justify-between gap-3">
                    <span className="text-xs font-sans font-medium text-foreground w-36 truncate">
                      {catKey}
                    </span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                        {curr}
                      </span>
                      <input
                        type="number"
                        value={currentVal || ""}
                        onChange={(e) =>
                          setAllocations({
                            ...allocations,
                            [catKey]: e.target.value ? Number(e.target.value) : 0,
                          })
                        }
                        placeholder="0"
                        className="w-full pl-12 pr-3 py-1.5 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-xs font-mono text-foreground"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-muted">
              <button
                type="button"
                onClick={() => setShowAllocationModal(false)}
                className="px-4 py-2 rounded-xl border border-muted hover:bg-surface-hover text-xs font-sans text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAllocations}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-50 text-accent-foreground font-medium text-xs font-sans transition-all"
              >
                {isSubmitting ? "Saving..." : "Save Allocations"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTLE DEPOSIT REFUND MODAL (REQ-BDG-03) */}
      {refundModalExpense && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setRefundModalExpense(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overscroll-contain"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full p-6 rounded-2xl border border-muted bg-surface shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-display text-lg text-foreground font-normal">
                  Settle Deposit: {refundModalExpense.title}
                </h3>
              </div>
              <button
                onClick={() => setRefundModalExpense(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-background border border-muted text-xs font-sans space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Original Deposit Paid:</span>
                  <span className="font-mono text-foreground font-semibold">
                    {refundModalExpense.currency} {refundModalExpense.amount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-sans font-medium text-foreground">Refund Status</label>
                <Select
                  value={refundStatusInput}
                  onChange={(e) => setRefundStatusInput(e.target.value as DepositRefundStatus)}
                  options={[
                    { value: "REFUNDED", label: "Fully or Partially Refunded" },
                    { value: "DEDUCTED", label: "Fully Deducted (Penalty / Damage)" },
                    { value: "PENDING", label: "Revert to Pending" },
                  ]}
                />
              </div>

              {refundStatusInput === "REFUNDED" && (
                <div className="space-y-1">
                  <label className="text-xs font-sans font-medium text-foreground">
                    Actual Refund Amount Received ({curr})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={refundAmountInput}
                    onChange={(e) => setRefundAmountInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-muted focus:border-accent focus:outline-hidden text-sm font-mono text-foreground"
                  />
                  {parseFloat(refundAmountInput || "0") < refundModalExpense.amount && (
                    <span className="text-[10px] text-amber-800 font-medium block pt-1">
                      Note: Difference of {curr} {(refundModalExpense.amount - parseFloat(refundAmountInput || "0")).toLocaleString()} will be counted as spent due to deduction.
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-muted">
                <button
                  type="button"
                  onClick={() => setRefundModalExpense(null)}
                  className="px-4 py-2 rounded-xl border border-muted hover:bg-surface-hover text-xs font-sans text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRefund}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs font-sans transition-all"
                >
                  Confirm Settlement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
