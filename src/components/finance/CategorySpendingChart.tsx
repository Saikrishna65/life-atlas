"use client";

import React from "react";
import { CategorySpendingItem, formatPaise } from "@/lib/finance";
import { PieChart, Utensils, ShoppingCart, Home, Zap, Car, ShoppingBag, HeartPulse, Film, Plane, TrendingUp, CircleDollarSign, Briefcase, Laptop, LineChart, Wallet, ArrowLeftRight, MoreHorizontal } from "lucide-react";

interface CategorySpendingChartProps {
  categories: CategorySpendingItem[];
  totalExpensesPaise: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Utensils,
  ShoppingCart,
  Home,
  Zap,
  Car,
  ShoppingBag,
  HeartPulse,
  Film,
  Plane,
  TrendingUp,
  CircleDollarSign,
  Briefcase,
  Laptop,
  LineChart,
  Wallet,
  ArrowLeftRight,
  MoreHorizontal,
};

export default function CategorySpendingChart({
  categories,
  totalExpensesPaise,
}: CategorySpendingChartProps) {
  if (categories.length === 0 || totalExpensesPaise === 0) {
    return (
      <div className="p-8 rounded-2xl border border-muted bg-surface/50 text-center space-y-2">
        <PieChart className="w-8 h-8 text-muted-foreground/40 mx-auto" />
        <p className="text-xs text-muted-foreground font-sans">
          No category expenses recorded for this period.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-muted bg-surface space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-foreground">
            Spending by Category
          </h3>
        </div>
        <span className="text-[11px] font-mono font-semibold text-muted-foreground">
          {formatPaise(totalExpensesPaise)}
        </span>
      </div>

      {/* Progress Bars List */}
      <div className="space-y-3 pt-1">
        {categories.slice(0, 6).map((item) => {
          const IconComponent = ICON_MAP[item.categoryIcon] || MoreHorizontal;

          return (
            <div key={item.categoryId} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate pr-2">
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${item.categoryColor}20`, color: item.categoryColor }}
                  >
                    <IconComponent className="w-3 h-3" />
                  </div>
                  <span className="font-medium text-foreground truncate">{item.categoryName}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                  <span className="text-muted-foreground">{item.percentage}%</span>
                  <span className="font-semibold text-foreground">{formatPaise(item.totalSpentPaise)}</span>
                </div>
              </div>

              {/* Progress track */}
              <div className="h-1.5 w-full bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(3, item.percentage))}%`,
                    backgroundColor: item.categoryColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

