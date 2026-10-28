"use client";

import React from "react";
import { CashFlowTimelinePoint, formatPaise } from "@/lib/finance";
import { TrendingUp, BarChart3 } from "lucide-react";

interface CashFlowChartProps {
  timeline: CashFlowTimelinePoint[];
  totalIncomePaise: number;
  totalExpensesPaise: number;
}

export default function CashFlowChart({
  timeline,
  totalIncomePaise,
  totalExpensesPaise,
}: CashFlowChartProps) {
  if (timeline.length === 0 || (totalIncomePaise === 0 && totalExpensesPaise === 0)) {
    return (
      <div className="p-8 rounded-2xl border border-muted bg-white text-center space-y-2 shadow-soft">
        <BarChart3 className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="text-xs text-slate-500 font-sans">
          No cash flow activity recorded for this period.
        </p>
      </div>
    );
  }

  // Find max value across all timeline points to scale the bars
  const maxPaise = Math.max(
    ...timeline.map((p) => Math.max(p.incomePaise, p.expensePaise)),
    100
  );

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-muted bg-white space-y-4 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-700" />
          <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-900">
            Income vs Expenses
          </h3>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-sans">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
            <span>Income</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-600" />
            <span>Expenses</span>
          </span>
        </div>
      </div>

      {/* Responsive Bar Visualization */}
      <div
        className="pt-4 pb-1 overflow-x-auto no-scrollbar"
        role="region"
        aria-label="Income and expense chart by date"
      >
        <div className="min-w-[280px] h-36 flex items-end justify-between gap-2 sm:gap-3 px-1 border-b border-slate-100">
          {timeline.map((point) => {
            const incomeHeight = Math.max(4, Math.round((point.incomePaise / maxPaise) * 110));
            const expenseHeight = Math.max(4, Math.round((point.expensePaise / maxPaise) * 110));

            return (
              <div
                key={point.dateKey}
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative"
              >
                {/* Tooltip on hover/focus */}
                <div className="absolute -top-14 hidden group-hover:flex flex-col items-center z-20 pointer-events-none whitespace-nowrap bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-md text-[10px] font-mono">
                  <span className="text-slate-600 font-semibold">{point.dateLabel}</span>
                  <span className="text-emerald-700 font-semibold">+{formatPaise(point.incomePaise)}</span>
                  <span className="text-rose-700 font-semibold">-{formatPaise(point.expensePaise)}</span>
                </div>

                {/* Paired Bars */}
                <div className="w-full flex items-end justify-center gap-1 h-28">
                  {/* Income Bar */}
                  <div
                    style={{ height: `${point.incomePaise > 0 ? incomeHeight : 0}px` }}
                    className="w-1/2 max-w-[14px] bg-emerald-600/90 rounded-t-xs hover:bg-emerald-600 transition-colors"
                    title={`Income: ${formatPaise(point.incomePaise)}`}
                  />
                  {/* Expense Bar */}
                  <div
                    style={{ height: `${point.expensePaise > 0 ? expenseHeight : 0}px` }}
                    className="w-1/2 max-w-[14px] bg-rose-600/90 rounded-t-xs hover:bg-rose-600 transition-colors"
                    title={`Expense: ${formatPaise(point.expensePaise)}`}
                  />
                </div>

                {/* X-axis date label */}
                <span className="text-[10px] font-mono text-slate-500 truncate w-full text-center">
                  {point.dateLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

