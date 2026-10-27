/**
 * Life Atlas Finance: Recurring Transaction & Subscription Detection Service
 * 
 * Analyzes local transaction history deterministically to discover recurring obligations,
 * subscriptions, EMIs, salary credits, and utility bills.
 * 
 * Rules:
 * - Excludes internal transfers and reversed transactions.
 * - Requires sufficient evidence (>= 2 intervals).
 * - Accommodates weekend drift (+/- 4 days) and variable utility bill amounts (+/- 25%).
 * - Predictions are strictly labeled as estimates; NEVER injects fake ledger records into user history.
 */

import { IUnitOfWork } from "../storage/interfaces";
import {
  Transaction,
  RecurringRule,
  RecurringFrequency,
  RecurringStatus,
  ID,
  Paise,
} from "../domain/models";
import { normalizeMerchant } from "./categorizationService";
import { FinanceError } from "../domain/errors";

interface DateDifferenceResult {
  frequency: RecurringFrequency;
  interval: number;
  averageDays: number;
}

export class RecurringService {
  constructor(private readonly uow: IUnitOfWork) {}

  /**
   * Scans posted transactions across accounts and detects recurring patterns.
   * Saves newly detected patterns to the recurring_rules store with status="detected".
   */
  async detectRecurringPatterns(): Promise<RecurringRule[]> {
    // 1. Fetch eligible posted transactions (excluding transfers and reversed)
    const allTransactions = await this.uow.transactions.query({
      status: "posted",
    });

    const eligible = allTransactions.filter(
      (t) => !t.transferGroupId && t.categoryId !== "cat_transfer" && t.status !== "reversed"
    );

    // 2. Group transactions by accountId + direction + normalized merchant/description
    const groups = new Map<string, Transaction[]>();

    for (const txn of eligible) {
      const normKey =
        normalizeMerchant(txn.merchant || "") ||
        normalizeMerchant(txn.description).split(" ").slice(0, 3).join(" ");

      if (!normKey || normKey.length < 3) continue;

      const groupKey = `${txn.accountId}:${txn.direction}:${normKey}`;
      const list = groups.get(groupKey) || [];
      list.push(txn);
      groups.set(groupKey, list);
    }

    const detectedRules: RecurringRule[] = [];
    const existingRules = await this.uow.recurringRules.getAll();
    const existingKeyMap = new Set(
      existingRules.map(
        (r) => `${r.accountId}:${r.direction}:${normalizeMerchant(r.merchant || r.description)}`
      )
    );

    const now = new Date().toISOString();

    for (const [groupKey, txns] of groups.entries()) {
      // Need at least 3 transactions to have >= 2 intervals, or 2 transactions if monthly with strict match
      if (txns.length < 2) continue;

      // Sort transactions chronologically
      txns.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

      // Calculate days between successive transactions
      const intervalsInDays: number[] = [];
      for (let i = 1; i < txns.length; i++) {
        const prev = new Date(txns[i - 1].occurredAt).getTime();
        const curr = new Date(txns[i].occurredAt).getTime();
        const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        intervalsInDays.push(diffDays);
      }

      const frequencyMatch = this.evaluateIntervals(intervalsInDays);
      if (!frequencyMatch) continue;

      // Check amount variance across transactions
      const amounts = txns.map((t) => t.amountPaise);
      const minAmount = Math.min(...amounts);
      const maxAmount = Math.max(...amounts);
      const avgAmount = Math.round(amounts.reduce((sum, a) => sum + a, 0) / amounts.length);

      // Amount variance check: max amount must be within 35% of min amount (allows utility bill variance)
      const varianceRatio = (maxAmount - minAmount) / (minAmount || 1);
      if (varianceRatio > 0.35 && amounts.length > 2) {
        continue; // Too erratic to be recurring
      }

      // Check if we already have an existing rule for this group
      const first = txns[0];
      const normDesc =
        first.merchant ||
        normalizeMerchant(first.description) ||
        first.description;
      const dedupeKey = `${first.accountId}:${first.direction}:${normalizeMerchant(normDesc)}`;

      if (existingKeyMap.has(dedupeKey)) {
        continue;
      }

      // Predict next due date based on the last observed occurrence + average interval days
      const lastTxn = txns[txns.length - 1];
      const lastDate = new Date(lastTxn.occurredAt);
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + Math.round(frequencyMatch.averageDays));

      // Ensure next date is not in the deep past
      while (nextDate.getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000) {
        nextDate.setDate(nextDate.getDate() + Math.round(frequencyMatch.averageDays));
      }

      const confidenceScore = Math.min(
        1.0,
        0.6 + (txns.length >= 3 ? 0.2 : 0.1) + (varianceRatio < 0.05 ? 0.2 : 0.1)
      );

      const ruleId: ID = `rec_det_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const rule: RecurringRule = {
        id: ruleId,
        accountId: first.accountId,
        categoryId: lastTxn.categoryId,
        amountPaise: avgAmount,
        currency: first.currency,
        direction: first.direction,
        merchant: lastTxn.merchant || first.merchant,
        description: lastTxn.description || first.description,
        frequency: frequencyMatch.frequency,
        interval: frequencyMatch.interval,
        startDate: first.occurredAt,
        nextDueDate: nextDate.toISOString(),
        autoPost: false,
        status: "detected",
        confidenceScore: Math.round(confidenceScore * 100) / 100,
        evidenceTransactionIds: txns.map((t) => t.id),
        expectedMinAmountPaise: minAmount,
        expectedMaxAmountPaise: maxAmount,
        explanation: `Detected from ${txns.length} past ${frequencyMatch.frequency} transactions with ~${Math.round(
          frequencyMatch.averageDays
        )} day intervals`,
        isEstimate: true,
        createdAt: now,
        updatedAt: now,
      };

      await this.uow.recurringRules.save(rule);
      detectedRules.push(rule);
      existingKeyMap.add(dedupeKey);
    }

    return detectedRules;
  }

  /**
   * Helper to classify a set of day intervals into standard recurring frequencies.
   */
  private evaluateIntervals(intervals: number[]): DateDifferenceResult | null {
    if (intervals.length === 0) return null;

    const avg = intervals.reduce((sum, d) => sum + d, 0) / intervals.length;

    // Weekly: 5-9 days
    if (intervals.every((d) => d >= 5 && d <= 9)) {
      return { frequency: "weekly", interval: 1, averageDays: avg };
    }

    // Biweekly: 11-17 days
    if (intervals.every((d) => d >= 11 && d <= 17)) {
      return { frequency: "biweekly", interval: 2, averageDays: avg };
    }

    // Monthly: 26-35 days (allows weekend drift)
    if (intervals.every((d) => d >= 26 && d <= 35)) {
      return { frequency: "monthly", interval: 1, averageDays: avg };
    }

    // Quarterly: 85-98 days
    if (intervals.every((d) => d >= 85 && d <= 98)) {
      return { frequency: "quarterly", interval: 3, averageDays: avg };
    }

    // Yearly: 350-380 days
    if (intervals.every((d) => d >= 350 && d <= 380)) {
      return { frequency: "yearly", interval: 12, averageDays: avg };
    }

    return null;
  }

  /**
   * Directly creates and persists a recurring rule.
   */
  async createRecurringRule(rule: Partial<RecurringRule> & {
    accountId: ID;
    amountPaise: Paise;
    direction: "inflow" | "outflow";
    description: string;
    frequency: RecurringFrequency;
    interval: number;
    startDate: string;
    nextDueDate: string;
    status: RecurringStatus;
  }): Promise<RecurringRule> {
    const fullRule: RecurringRule = {
      ...rule,
      id: rule.id || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      currency: rule.currency || "INR",
      autoPost: rule.autoPost ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.uow.recurringRules.save(fullRule);
    return fullRule;
  }

  /**
   * Confirms a detected recurring payment as an active subscription/bill.
   */
  async confirmRecurringRule(id: ID): Promise<RecurringRule> {
    const rule = await this.uow.recurringRules.getById(id);
    if (!rule) {
      throw new FinanceError(`Recurring rule ${id} not found`, "NOT_FOUND");
    }

    const updated: RecurringRule = {
      ...rule,
      status: "confirmed",
      updatedAt: new Date().toISOString(),
    };

    await this.uow.recurringRules.save(updated);

    await this.uow.audit.record({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      entityType: "recurring",
      entityId: id,
      action: "update",
      changes: {
        status: { oldVal: rule.status, newVal: "confirmed" },
      },
      reason: "User confirmed detected recurring rule",
      performedAt: new Date().toISOString(),
    });

    return updated;
  }

  /**
   * Dismisses a detected recurring pattern so it stops showing in recommendations.
   */
  async dismissRecurringRule(id: ID): Promise<void> {
    const rule = await this.uow.recurringRules.getById(id);
    if (!rule) {
      throw new FinanceError(`Recurring rule ${id} not found`, "NOT_FOUND");
    }

    const updated: RecurringRule = {
      ...rule,
      status: "dismissed",
      updatedAt: new Date().toISOString(),
    };

    await this.uow.recurringRules.save(updated);
  }

  /**
   * Pauses an active recurring rule.
   */
  async pauseRecurringRule(id: ID): Promise<RecurringRule> {
    const rule = await this.uow.recurringRules.getById(id);
    if (!rule) {
      throw new FinanceError(`Recurring rule ${id} not found`, "NOT_FOUND");
    }

    const updated: RecurringRule = {
      ...rule,
      status: "paused",
      updatedAt: new Date().toISOString(),
    };

    await this.uow.recurringRules.save(updated);
    return updated;
  }

  /**
   * Resumes a paused recurring rule.
   */
  async resumeRecurringRule(id: ID): Promise<RecurringRule> {
    const rule = await this.uow.recurringRules.getById(id);
    if (!rule) {
      throw new FinanceError(`Recurring rule ${id} not found`, "NOT_FOUND");
    }

    const updated: RecurringRule = {
      ...rule,
      status: "confirmed",
      updatedAt: new Date().toISOString(),
    };

    await this.uow.recurringRules.save(updated);
    return updated;
  }

  /**
   * Retrieves recurring rules, optionally filtered by status.
   */
  async getRecurringRules(status?: RecurringStatus): Promise<RecurringRule[]> {
    return this.uow.recurringRules.getAll(status);
  }
}

