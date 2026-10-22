"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { parseCalendarDate, getTripDayCount } from "@/lib/vault/tripDuration";

export interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  onChange: (startDate: string, endDate: string) => void;
  className?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  className = "",
}: DateRangePickerProps) {
  // Active calendar view month & year (initialized from startDate or current date)
  const initialDate = useMemo(() => {
    return parseCalendarDate(startDate);
  }, [startDate]);

  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-indexed
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Quick navigation
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Format a Date object into YYYY-MM-DD
  const formatDateString = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    const prevMonthDaysCount = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, prevMonthDaysCount - i);
      days.push({
        dateStr: formatDateString(d),
        dayNum: prevMonthDaysCount - i,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(viewYear, viewMonth, d);
      days.push({
        dateStr: formatDateString(dateObj),
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill out 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      days.push({
        dateStr: formatDateString(d),
        dayNum: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  // Handle day click
  const handleDayClick = (dateStr: string) => {
    // If we have both or none, start new selection
    if (!startDate || (startDate && endDate)) {
      onChange(dateStr, "");
    } else if (startDate && !endDate) {
      // If clicking before startDate, flip or restart
      if (dateStr < startDate) {
        onChange(dateStr, startDate);
      } else {
        onChange(startDate, dateStr);
      }
    }
  };

  // Quick preset helper
  const handleApplyPreset = (daysCount: number) => {
    const start = startDate ? parseCalendarDate(startDate) : new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + (daysCount - 1));

    const sStr = formatDateString(start);
    const eStr = formatDateString(end);
    onChange(sStr, eStr);

    // Make sure calendar shows start month
    setViewYear(start.getFullYear());
    setViewMonth(start.getMonth());
  };

  // Range breakdown calculation
  const durationInfo = useMemo(() => {
    if (!startDate) return null;
    return getTripDayCount(startDate, endDate || startDate);
  }, [startDate, endDate]);

  const effectiveEndDate = endDate || hoverDate || "";

  return (
    <div className={`rounded-3xl bg-surface border border-muted p-4 sm:p-5 space-y-4 shadow-sm ${className}`}>
      {/* Header with Title and Month Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-accent/10 border border-accent/20 text-accent">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block">
              Expedition Calendar
            </span>
            <span className="text-sm font-sans font-semibold text-foreground">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-xl bg-background border border-muted hover:border-foreground/30 text-foreground transition-colors cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-xl bg-background border border-muted hover:border-foreground/30 text-foreground transition-colors cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Duration Presets */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[11px] font-mono text-muted-foreground mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-accent" />
          <span>Quick:</span>
        </span>
        {[
          { label: "3 Days", days: 3 },
          { label: "5 Days", days: 5 },
          { label: "1 Week", days: 7 },
          { label: "10 Days", days: 10 },
          { label: "2 Weeks", days: 14 },
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handleApplyPreset(preset.days)}
            className="px-2.5 py-1 rounded-lg bg-background border border-muted hover:border-accent/40 text-[11px] font-mono text-foreground hover:text-accent transition-colors cursor-pointer"
          >
            {preset.label}
          </button>
        ))}

        {endDate && (
          <button
            type="button"
            onClick={() => onChange(startDate, "")}
            className="px-2 py-1 rounded-lg text-[10px] font-mono text-muted-foreground hover:text-rose-400 ml-auto flex items-center gap-1 transition-colors"
            title="Reset return date"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Return</span>
          </button>
        )}
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] text-muted-foreground uppercase pt-1">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
          const isStart = dateStr === startDate;
          const isEnd = dateStr === endDate;
          const inRange =
            startDate &&
            effectiveEndDate &&
            dateStr > startDate &&
            dateStr < effectiveEndDate;
          const isSingleSelected = isStart && (!endDate || startDate === endDate);

          return (
            <div
              key={dateStr}
              onMouseEnter={() => {
                if (startDate && !endDate && dateStr > startDate) {
                  setHoverDate(dateStr);
                }
              }}
              onMouseLeave={() => setHoverDate(null)}
              className={`relative py-1 flex items-center justify-center transition-all ${
                inRange ? "bg-accent/15" : ""
              } ${isStart && effectiveEndDate && dateStr < effectiveEndDate ? "rounded-l-2xl bg-accent/15" : ""} ${
                isEnd ? "rounded-r-2xl bg-accent/15" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => handleDayClick(dateStr)}
                className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-xs sm:text-sm font-sans transition-all duration-150 cursor-pointer ${
                  !isCurrentMonth
                    ? "text-muted-foreground/40 hover:text-foreground"
                    : "text-foreground hover:bg-surface-hover"
                } ${
                  isStart
                    ? "bg-accent text-accent-foreground font-bold shadow-md ring-2 ring-accent/30 z-10 scale-105"
                    : ""
                } ${
                  isEnd
                    ? "bg-amber-500 text-black font-bold shadow-md ring-2 ring-amber-500/30 z-10 scale-105"
                    : ""
                } ${inRange && !isStart && !isEnd ? "font-medium text-accent" : ""}`}
              >
                <span>{dayNum}</span>
                {isStart && (
                  <span className="text-[8px] font-mono leading-none tracking-tight -mt-0.5 uppercase opacity-90">
                    Depart
                  </span>
                )}
                {isEnd && (
                  <span className="text-[8px] font-mono leading-none tracking-tight -mt-0.5 uppercase opacity-90">
                    Return
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Selected Dates & Duration Summary Banner */}
      <div className="pt-2 border-t border-muted/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20 text-accent font-semibold">
            <span>Start:</span>
            <span>{startDate || "Select Departure"}</span>
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 font-semibold">
            <span>Return:</span>
            <span>{endDate || "Select Return"}</span>
          </span>
        </div>

        {durationInfo && (
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400 font-semibold">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>{durationInfo.formatted}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
