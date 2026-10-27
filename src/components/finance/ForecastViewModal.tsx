"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Sliders,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from "lucide-react";
import {
  ForecastHorizon,
  CashFlowForecast,
  RunwayEstimate,
  CategoryBudgetProjection,
  ScenarioPlanOptions,
  ForecastService,
  RunwayService,
  BudgetProjectionService,
  formatPaise,
  parsePaise,
  ProjectedCashFlowPoint,
} from "@/lib/finance";

interface ForecastViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  forecastService: ForecastService;
  runwayService: RunwayService;
  budgetProjectionService: BudgetProjectionService;
}

export default function ForecastViewModal({
  isOpen,
  onClose,
  forecastService,
  runwayService,
  budgetProjectionService,
}: ForecastViewModalProps) {
  const [horizon, setHorizon] = useState<ForecastHorizon>("30_days");
  const [activeTab, setActiveTab] = useState<"TIMELINE" | "BUDGETS" | "SCENARIO">("TIMELINE");

  // Data states
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null);
  const [runway, setRunway] = useState<RunwayEstimate | null>(null);
  const [budgetProjections, setBudgetProjections] = useState<CategoryBudgetProjection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scenario Simulator Inputs
  const [discretionaryCutPercent, setDiscretionaryCutPercent] = useState(0);
  const [plannedExpenseDesc, setPlannedExpenseDesc] = useState("");
  const [plannedExpenseRupees, setPlannedExpenseRupees] = useState("");
  const [plannedExpenseDays, setPlannedExpenseDays] = useState("7");
  const [incomeAdjustmentRupees, setIncomeAdjustmentRupees] = useState("");

  const scenarioOptions: ScenarioPlanOptions | undefined = useMemo(() => {
    const hasReduction = discretionaryCutPercent > 0;
    const parsedIncomeRupees = parseFloat(incomeAdjustmentRupees);
    const hasIncomeAdj = !isNaN(parsedIncomeRupees) && parsedIncomeRupees !== 0;
    const parsedExpenseRupees = parseFloat(plannedExpenseRupees);
    const hasPlannedExpense = !isNaN(parsedExpenseRupees) && parsedExpenseRupees > 0;

    if (!hasReduction && !hasIncomeAdj && !hasPlannedExpense) {
      return undefined;
    }

    const plannedOneOffExpenses: ScenarioPlanOptions["plannedOneOffExpenses"] = [];
    if (hasPlannedExpense) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + parseInt(plannedExpenseDays || "7", 10));
      plannedOneOffExpenses.push({
        amountPaise: parsePaise(plannedExpenseRupees),
        date: expDate.toISOString(),
        description: plannedExpenseDesc || "Planned one-time expense",
      });
    }

    return {
      discretionaryCutPercent: hasReduction ? discretionaryCutPercent : undefined,
      incomeAdjustmentPaise: hasIncomeAdj ? parsePaise(incomeAdjustmentRupees) : undefined,
      plannedOneOffExpenses: plannedOneOffExpenses.length > 0 ? plannedOneOffExpenses : undefined,
    };
  }, [discretionaryCutPercent, plannedExpenseRupees, plannedExpenseDesc, plannedExpenseDays, incomeAdjustmentRupees]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Generate Cash-Flow Forecast
      const fc = await forecastService.generateForecast(horizon, scenarioOptions);
      setForecast(fc);

      // 2. Calculate Runway
      const rw = await runwayService.computeRunway();
      setRunway(rw);

      // 3. Project current month's category budgets
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
      const bp = await budgetProjectionService.projectEndOfMonthBudgets(monthStart, monthEnd);
      setBudgetProjections(bp);
    } catch (err: unknown) {
      console.error("Forecast generation failed:", err);
      setError(err instanceof Error ? err.message : "Failed to generate forecasting report");
    } finally {
      setIsLoading(false);
    }
  }, [forecastService, runwayService, budgetProjectionService, horizon, scenarioOptions]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleResetScenario = () => {
    setDiscretionaryCutPercent(0);
    setPlannedExpenseDesc("");
    setPlannedExpenseRupees("");
    setPlannedExpenseDays("7");
    setIncomeAdjustmentRupees("");
  };

  if (!isOpen) return null;

  // Chart calculation metrics
  const chartPoints: ProjectedCashFlowPoint[] = forecast?.dailyPoints || [];
  const minBalance = chartPoints.reduce((min, p) => Math.min(min, p.projectedBalancePaise), forecast?.startingLiquidPaise || 0);
  const maxBalance = chartPoints.reduce((max, p) => Math.max(max, p.projectedBalancePaise), forecast?.startingLiquidPaise || 0);
  const balanceRange = Math.max(1, maxBalance - minBalance);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl bg-surface border border-muted rounded-2xl p-5 sm:p-6 shadow-2xl relative my-auto animate-fade-in max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-muted">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-normal text-foreground">
                Predictive Forecasting & Runway
              </h2>
              <p className="text-xs text-muted-foreground">
                Deterministic cash-flow simulation, burn rate analysis, and what-if scenario testing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto space-y-5 py-4 pr-1 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Horizon Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-background/60 p-2 rounded-xl border border-muted">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-2">
              Forecast Horizon:
            </span>
            <div className="flex items-center gap-1">
              {(
                [
                  { id: "7_days", label: "7 Days" },
                  { id: "30_days", label: "30 Days" },
                  { id: "90_days", label: "90 Days" },
                  { id: "12_months", label: "12 Months" },
                ] as const
              ).map((h) => (
                <button
                  key={h.id}
                  onClick={() => setHorizon(h.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${horizon === h.id
                      ? "bg-purple-500 text-white shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface"
                    }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Low Balance Warning Alert */}
          {forecast?.lowBalanceDate && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs text-amber-300">Projected Balance Dip Alert</p>
                <p className="text-[11px] text-amber-400/90 mt-0.5">
                  Liquid cash balance is projected to dip below reserve on{" "}
                  <span className="font-mono font-semibold">
                    {new Date(forecast.lowBalanceDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  . Consider deferring planned expenses or transferring reserves.
                </p>
              </div>
            </div>
          )}

          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 1. Starting Liquid Assets */}
            <div className="p-3 rounded-xl bg-background/70 border border-muted flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <Wallet className="w-3 h-3 text-emerald-400" />
                Liquid Assets
              </span>
              <div className="mt-2">
                <div className="font-mono text-sm sm:text-base font-semibold text-foreground">
                  {forecast ? formatPaise(forecast.startingLiquidPaise) : "..."}
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">Spendable Cash + Bank</p>
              </div>
            </div>

            {/* 2. Projected Net Cash Flow */}
            <div className="p-3 rounded-xl bg-background/70 border border-muted flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-purple-400" />
                Projected Net
              </span>
              <div className="mt-2">
                <div
                  className={`font-mono text-sm sm:text-base font-semibold ${(forecast?.projectedNetCashFlowPaise || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                >
                  {forecast
                    ? `${forecast.projectedNetCashFlowPaise >= 0 ? "+" : ""}${formatPaise(
                      forecast.projectedNetCashFlowPaise
                    )}`
                    : "..."}
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">Inflow vs Outflow</p>
              </div>
            </div>

            {/* 3. Ending Balance */}
            <div className="p-3 rounded-xl bg-background/70 border border-muted flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-400" />
                Ending Balance
              </span>
              <div className="mt-2">
                <div
                  className={`font-mono text-sm sm:text-base font-semibold ${(forecast?.projectedLiquidPaise || 0) >= 0 ? "text-foreground" : "text-rose-400"
                    }`}
                >
                  {forecast ? formatPaise(forecast.projectedLiquidPaise) : "..."}
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">At horizon end</p>
              </div>
            </div>

            {/* 4. Runway Estimate */}
            <div className="p-3 rounded-xl bg-background/70 border border-muted flex flex-col justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                Runway
              </span>
              <div className="mt-2">
                <div className="font-mono text-sm sm:text-base font-semibold text-foreground">
                  {runway
                    ? runway.status === "surplus"
                      ? "Surplus (Net Inflow)"
                      : runway.runwayMonths !== null
                        ? `${runway.runwayMonths.toFixed(1)} Mos`
                        : "0 Days"
                    : "..."}
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {runway?.status === "surplus"
                    ? "Zero monthly burn rate"
                    : `Burn: ${formatPaise(runway?.monthlyBurnRatePaise || 0)}/mo`}
                </p>
              </div>
            </div>
          </div>

          {/* SVG Cash Flow Timeline Projection Chart */}
          {chartPoints.length > 0 && (
            <div className="p-3.5 rounded-xl bg-background/60 border border-muted space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                  Projected Liquid Balance Curve
                </span>
                <span className="font-mono text-muted-foreground text-[10px]">
                  Lowest:{" "}
                  <span
                    className={
                      forecast?.lowestProjectedBalancePaise && forecast.lowestProjectedBalancePaise < 0
                        ? "text-rose-400 font-bold"
                        : "text-foreground"
                    }
                  >
                    {formatPaise(forecast?.lowestProjectedBalancePaise || 0)}
                  </span>
                </span>
              </div>

              {/* Responsive SVG Chart */}
              <div className="h-28 w-full relative">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox={`0 0 ${chartPoints.length * 20} 100`}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Zero / Baseline Axis */}
                  <line
                    x1="0"
                    y1={100 - ((0 - minBalance) / balanceRange) * 100}
                    x2={chartPoints.length * 20}
                    y2={100 - ((0 - minBalance) / balanceRange) * 100}
                    stroke="#52525b"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.4"
                  />

                  {/* Filled Area */}
                  {chartPoints.length > 1 && (
                    <polygon
                      points={`0,100 ${chartPoints
                        .map((p: ProjectedCashFlowPoint, idx: number) => {
                          const x = idx * 20;
                          const y = 100 - ((p.projectedBalancePaise - minBalance) / balanceRange) * 90 - 5;
                          return `${x},${y}`;
                        })
                        .join(" ")} ${(chartPoints.length - 1) * 20},100`}
                      fill="url(#forecastFill)"
                    />
                  )}

                  {/* Projection Line */}
                  {chartPoints.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#c084fc"
                      strokeWidth="2"
                      points={chartPoints
                        .map((p: ProjectedCashFlowPoint, idx: number) => {
                          const x = idx * 20;
                          const y = 100 - ((p.projectedBalancePaise - minBalance) / balanceRange) * 90 - 5;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                    />
                  )}

                  {/* Points */}
                  {chartPoints.map((p: ProjectedCashFlowPoint, idx: number) => {
                    const x = idx * 20;
                    const y = 100 - ((p.projectedBalancePaise - minBalance) / balanceRange) * 90 - 5;
                    const isDip = p.projectedBalancePaise < 0;
                    return (
                      <circle
                        key={idx}
                        cx={x}
                        cy={y}
                        r={isDip ? 4 : 2}
                        className={isDip ? "fill-rose-500 animate-pulse" : "fill-purple-400"}
                      />
                    );
                  })}
                </svg>
              </div>

              <div className="flex justify-between text-[10px] text-muted-foreground pt-1 border-t border-muted/40 font-mono">
                <span>Start ({new Date(chartPoints[0].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})</span>
                <span>End ({new Date(chartPoints[chartPoints.length - 1].date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})</span>
              </div>
            </div>
          )}

          {/* Subtabs for Detail & Scenarios */}
          <div className="flex items-center gap-1 border-b border-muted pb-2">
            <button
              onClick={() => setActiveTab("TIMELINE")}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors cursor-pointer ${activeTab === "TIMELINE"
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Upcoming Obligations ({forecast?.upcomingObligations.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("BUDGETS")}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors cursor-pointer ${activeTab === "BUDGETS"
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Month-End Budgets ({budgetProjections.length})
            </button>
            <button
              onClick={() => setActiveTab("SCENARIO")}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors cursor-pointer ${activeTab === "SCENARIO"
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              What-If Simulator {scenarioOptions ? "(Active)" : ""}
            </button>
          </div>

          {/* TAB 1: Upcoming Obligations */}
          {activeTab === "TIMELINE" && (
            <div className="space-y-2">
              {forecast?.upcomingObligations.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground rounded-xl border border-muted">
                  No confirmed recurring payments or scheduled obligations detected in this forecast window.
                </div>
              ) : (
                <div className="divide-y divide-muted border border-muted rounded-xl overflow-hidden bg-background/50">
                  {forecast?.upcomingObligations.map((ob, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-surface/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-1.5 rounded-md ${ob.direction === "inflow"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                            }`}
                        >
                          {ob.direction === "inflow" ? (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground text-xs">{ob.merchantOrDescription}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {new Date(ob.dueDate).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-mono font-semibold text-xs ${ob.direction === "inflow" ? "text-emerald-400" : "text-rose-400"
                            }`}
                        >
                          {ob.direction === "inflow" ? "+" : "-"}
                          {formatPaise(ob.amountPaise)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Budget Projections */}
          {activeTab === "BUDGETS" && (
            <div className="space-y-3">
              {budgetProjections.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground rounded-xl border border-muted">
                  No monthly category budgets configured. Create budgets in the Budgets tab to track projections.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {budgetProjections.map((bp) => {
                    const isOver = bp.riskLevel === "over_budget";
                    const isApproaching = bp.riskLevel === "approaching";

                    return (
                      <div
                        key={bp.categoryId}
                        className="p-3 rounded-xl border border-muted bg-background/50 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground text-xs">{bp.categoryName}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${isOver
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : isApproaching
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                }`}
                            >
                              {isOver ? "Over Budget" : isApproaching ? "Approaching" : "On Track"}
                            </span>
                          </div>
                          <div className="text-right font-mono text-[11px]">
                            <span className="text-muted-foreground">Limit: </span>
                            <span className="text-foreground font-semibold">{formatPaise(bp.allocatedPaise)}</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${isOver ? "bg-rose-500" : isApproaching ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                            style={{
                              width: `${Math.min(100, Math.round((bp.projectedEndOfMonthPaise / bp.allocatedPaise) * 100))}%`,
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                          <span>Spent so far: {formatPaise(bp.spentSoFarPaise)}</span>
                          <span>
                            Projected month-end:{" "}
                            <span className={isOver ? "text-rose-400 font-bold" : "text-foreground font-semibold"}>
                              {formatPaise(bp.projectedEndOfMonthPaise)}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: What-If Scenario Simulator */}
          {activeTab === "SCENARIO" && (
            <div className="space-y-4 p-3.5 rounded-xl border border-muted bg-background/50">
              <div className="flex items-center justify-between border-b border-muted pb-2">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  What-If Scenario Tuning (Non-Destructive)
                </span>
                {scenarioOptions && (
                  <button
                    onClick={handleResetScenario}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to Baseline
                  </button>
                )}
              </div>

              {/* 1. Discretionary Cut % Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <label className="text-[11px] text-muted-foreground">
                    Reduce Discretionary Spending:
                  </label>
                  <span className="font-mono text-purple-400 font-bold">{discretionaryCutPercent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={discretionaryCutPercent}
                  onChange={(e) => setDiscretionaryCutPercent(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <p className="text-[10px] text-muted-foreground">
                  Simulates spending cut on dining, shopping, entertainment and non-essential outflows.
                </p>
              </div>

              {/* 2. Planned One-off Expense */}
              <div className="space-y-1.5 pt-2 border-t border-muted/50">
                <label className="text-[11px] text-muted-foreground">
                  Simulate Planned One-Time Major Expense:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="e.g. New Laptop"
                    value={plannedExpenseDesc}
                    onChange={(e) => setPlannedExpenseDesc(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-muted bg-surface text-foreground text-xs focus:outline-hidden focus:border-purple-500"
                  />
                  <input
                    type="number"
                    placeholder="Amount in ₹"
                    value={plannedExpenseRupees}
                    onChange={(e) => setPlannedExpenseRupees(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-muted bg-surface text-foreground text-xs focus:outline-hidden focus:border-purple-500 font-mono"
                  />
                  <select
                    value={plannedExpenseDays}
                    onChange={(e) => setPlannedExpenseDays(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-muted bg-surface text-foreground text-xs focus:outline-hidden focus:border-purple-500 cursor-pointer"
                  >
                    <option value="3">In 3 Days</option>
                    <option value="7">In 1 Week</option>
                    <option value="14">In 2 Weeks</option>
                    <option value="30">In 1 Month</option>
                  </select>
                </div>
              </div>

              {/* 3. Income Adjustment */}
              <div className="space-y-1.5 pt-2 border-t border-muted/50">
                <div className="flex justify-between">
                  <label className="text-[11px] text-muted-foreground">
                    Income Adjustment (₹):
                  </label>
                  <span className="font-mono text-foreground font-bold">
                    {incomeAdjustmentRupees ? `₹${incomeAdjustmentRupees}` : "₹0"}
                  </span>
                </div>
                <input
                  type="number"
                  placeholder="e.g. 5000 or -2000"
                  value={incomeAdjustmentRupees}
                  onChange={(e) => setIncomeAdjustmentRupees(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-muted bg-surface text-foreground text-xs focus:outline-hidden focus:border-purple-500 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Model salary changes, bonus additions, or temporary freelance dry spells.
                </p>
              </div>
            </div>
          )}

          {/* Honest Disclosure & Data Quality Badge */}
          <div className="p-3 rounded-xl bg-surface border border-muted/60 space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${forecast?.dataQuality === "reasonable_coverage"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : forecast?.dataQuality === "user_adjusted_scenario"
                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}
              >
                Model Confidence: {forecast?.dataQuality.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {forecast?.dataQualityExplanation ||
                "Forecasts are deterministic mathematical simulations derived from confirmed recurring schedules and historical daily run rates. They are not financial guarantees or credit ratings."}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-muted flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface border border-muted hover:border-foreground/30 text-xs font-medium text-foreground transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
