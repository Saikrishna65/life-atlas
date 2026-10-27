/**
 * Life Atlas Finance: Smart Categorization Engine & Application Service
 * 
 * Local, deterministic, explainable categorization without external network calls or opaque black-boxes.
 * Enforces accounting invariants: rejects income categories for outflows and expense categories for inflows.
 */

import { IUnitOfWork } from "../storage/interfaces";
import {
  Transaction,
  CategorizationRule,
  RuleMatchType,
  ID,
  TransactionDirection,
} from "../domain/models";
import { CategorizationResult } from "../infrastructure/interfaces";
import { FinanceError } from "../domain/errors";

/**
 * Normalizes merchant names and bank narration text by stripping payment prefixes,
 * UPI handles, reference IDs, and special characters.
 */
export function normalizeMerchant(raw: string): string {
  if (!raw) return "";
  let clean = raw.toLowerCase().trim();

  // Strip common transaction type prefixes and payment routing prefixes repeatedly (e.g. "IMPS/P2A/...")
  const prefixRegex = /^(upi|pos|neft|rtgs|imps|ach|cms|e-mandate|mandate|nach|inb|wdr|dep|p2a|p2p|p2m|bil|pay)[\/\-_:\s]+/i;
  while (prefixRegex.test(clean)) {
    clean = clean.replace(prefixRegex, "");
  }

  // Strip UPI VPA handles (e.g. "swiggy@icici", "zepto@axisbank", "merchant@paytm")
  clean = clean.replace(/@([a-z0-9\-_]+)/gi, " ");

  // Strip common banking suffix noises (e.g. "ref: 12345", "rrn: 9876", "xx1234")
  clean = clean.replace(/(ref|rrn|txn|id|utr)[\s:\-_]*[a-z0-9]+/gi, " ");
  clean = clean.replace(/\bxx+\d+\b/gi, " ");

  // Strip arbitrary numeric reference strings (4 or more digits)
  clean = clean.replace(/\b\d{4,}\b/g, " ");

  // Replace special characters, punctuation and excess whitespace
  clean = clean.replace(/[^a-z0-9\s]/gi, " ");
  clean = clean.replace(/\s+/g, " ").trim();

  return clean;
}

export interface SaveRuleDTO {
  id?: ID;
  name: string;
  matchType: RuleMatchType;
  pattern: string;
  categoryId: ID;
  direction?: TransactionDirection;
  priority?: number;
  explanation?: string;
}

export class CategorizationService {
  constructor(private readonly uow: IUnitOfWork) {}

  /**
   * Suggests a category for an incoming transaction using active deterministic rules.
   * Explains why the rule matched and provides a defensible confidence score.
   */
  async suggestCategory(transaction: Partial<Transaction>): Promise<CategorizationResult | null> {
    const rawMerchant = transaction.merchant || "";
    const rawDescription = transaction.description || "";
    const normMerchant = normalizeMerchant(rawMerchant);
    const normDesc = normalizeMerchant(rawDescription);

    // If both merchant and description are empty, cannot suggest
    if (!normMerchant && !normDesc) {
      return null;
    }

    const rules = await this.uow.categorizationRules.getAll(true); // active rules only
    const allCategories = await this.uow.categories.getAll();
    const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

    // Evaluate rules in sorted priority order
    for (const rule of rules) {
      const targetCategory = categoryMap.get(rule.categoryId);
      if (!targetCategory) continue;

      // Invariant check: rule direction must match transaction direction if constrained
      if (rule.direction && transaction.direction && rule.direction !== transaction.direction) {
        continue;
      }

      // Invariant check: expense categories cannot be suggested for inflows, and vice versa
      if (transaction.direction === "inflow" && targetCategory.type === "expense") {
        continue;
      }
      if (transaction.direction === "outflow" && targetCategory.type === "income") {
        continue;
      }

      const pattern = rule.pattern.toLowerCase().trim();
      let matched = false;
      let matchTypeScore = 0.8;

      if (rule.matchType === "exact") {
        matched = normMerchant === pattern || normDesc === pattern;
        matchTypeScore = 1.0;
      } else if (rule.matchType === "starts_with") {
        matched = normMerchant.startsWith(pattern) || normDesc.startsWith(pattern);
        matchTypeScore = 0.9;
      } else if (rule.matchType === "contains") {
        matched = normMerchant.includes(pattern) || normDesc.includes(pattern);
        matchTypeScore = 0.85;
      } else if (rule.matchType === "regex") {
        try {
          const re = new RegExp(pattern, "i");
          matched = re.test(normMerchant) || re.test(normDesc);
          matchTypeScore = 0.75;
        } catch {
          matched = false;
        }
      }

      if (matched) {
        return {
          categoryId: targetCategory.id,
          categoryName: targetCategory.name,
          confidence: matchTypeScore,
          ruleMatched: rule.name,
          normalizedMerchant: normMerchant || normDesc,
        };
      }
    }

    return null;
  }

  /**
   * Learns from a user's manual correction or categorization.
   * Creates a dedicated user rule with high priority (priority 5) so future matches take precedence.
   */
  async learnUserCorrection(
    transaction: Transaction,
    userAssignedCategoryId: ID,
    customRuleName?: string
  ): Promise<CategorizationRule> {
    const category = await this.uow.categories.getById(userAssignedCategoryId);
    if (!category) {
      throw new FinanceError(`Category ${userAssignedCategoryId} does not exist`, "VALIDATION_FAILED");
    }

    // Accounting invariant check
    if (transaction.direction === "inflow" && category.type === "expense") {
      throw new FinanceError("Cannot assign an expense category to an inflow transaction", "INVARIANT_VIOLATION");
    }
    if (transaction.direction === "outflow" && category.type === "income") {
      throw new FinanceError("Cannot assign an income category to an outflow transaction", "INVARIANT_VIOLATION");
    }

    // Determine cleanest pattern
    const normMerchant = normalizeMerchant(transaction.merchant || "");
    const normDesc = normalizeMerchant(transaction.description);
    const pattern = normMerchant || normDesc.split(" ")[0] || normDesc;

    if (!pattern) {
      throw new FinanceError("Could not extract a valid pattern from this transaction", "VALIDATION_FAILED");
    }

    const now = new Date().toISOString();
    const ruleId: ID = `rule_user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const ruleName = customRuleName || `Rule: ${transaction.merchant || pattern} -> ${category.name}`;

    const newRule: CategorizationRule = {
      id: ruleId,
      name: ruleName,
      matchType: "contains",
      pattern,
      categoryId: userAssignedCategoryId,
      direction: transaction.direction,
      priority: 5, // User rules run with higher priority than default system rules (10-30)
      isSystem: false,
      isActive: true,
      explanation: `Learned from user correction on transaction ${transaction.id}`,
      createdAt: now,
      updatedAt: now,
    };

    await this.uow.categorizationRules.save(newRule);

    // Record audit event
    await this.uow.audit.record({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      entityType: "rule",
      entityId: ruleId,
      action: "create",
      changes: {
        pattern: { oldVal: null, newVal: pattern },
        categoryId: { oldVal: null, newVal: userAssignedCategoryId },
      },
      reason: "User rule learned from transaction categorization",
      performedAt: now,
    });

    return newRule;
  }

  /**
   * Applies an existing rule to uncategorized transactions and updates them.
   */
  async applyRuleToUncategorized(ruleId: string): Promise<{ appliedCount: number; updatedTransactionIds: ID[] }> {
    const rule = await this.uow.categorizationRules.getById(ruleId);
    if (!rule || !rule.isActive) {
      throw new FinanceError(`Rule ${ruleId} is not available or inactive`, "VALIDATION_FAILED");
    }

    const uncategorized = await this.getUncategorizedTransactions();
    const updatedTransactionIds: ID[] = [];

    const now = new Date().toISOString();
    for (const txn of uncategorized) {
      // Invariant check: rule direction matches
      if (rule.direction && txn.direction !== rule.direction) continue;

      const normMerchant = normalizeMerchant(txn.merchant || "");
      const normDesc = normalizeMerchant(txn.description);
      const pattern = rule.pattern.toLowerCase().trim();

      let matched = false;
      if (rule.matchType === "exact") {
        matched = normMerchant === pattern || normDesc === pattern;
      } else if (rule.matchType === "starts_with") {
        matched = normMerchant.startsWith(pattern) || normDesc.startsWith(pattern);
      } else if (rule.matchType === "contains") {
        matched = normMerchant.includes(pattern) || normDesc.includes(pattern);
      } else if (rule.matchType === "regex") {
        try {
          matched = new RegExp(pattern, "i").test(normMerchant) || new RegExp(pattern, "i").test(normDesc);
        } catch {
          matched = false;
        }
      }

      if (matched) {
        const updatedTxn: Transaction = {
          ...txn,
          categoryId: rule.categoryId,
          reviewRequired: false,
          updatedAt: now,
          version: txn.version + 1,
        };
        await this.uow.transactions.save(updatedTxn);
        updatedTransactionIds.push(txn.id);
      }
    }

    return { appliedCount: updatedTransactionIds.length, updatedTransactionIds };
  }

  /**
   * Retrieves all transactions requiring review or lacking category.
   */
  async getUncategorizedTransactions(): Promise<Transaction[]> {
    const all = await this.uow.transactions.query({
      status: "posted",
    });

    return all.filter((t) => !t.categoryId || t.reviewRequired);
  }

  /**
   * Creates or updates a categorization rule.
   */
  async saveRule(dto: SaveRuleDTO): Promise<CategorizationRule> {
    const now = new Date().toISOString();
    const id = dto.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const existing = dto.id ? await this.uow.categorizationRules.getById(dto.id) : null;

    const rule: CategorizationRule = {
      id,
      name: dto.name.trim(),
      matchType: dto.matchType,
      pattern: dto.pattern.trim().toLowerCase(),
      categoryId: dto.categoryId,
      direction: dto.direction,
      priority: dto.priority ?? 50,
      isSystem: existing?.isSystem ?? false,
      isActive: existing?.isActive ?? true,
      explanation: dto.explanation?.trim() || "User configured categorization rule",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await this.uow.categorizationRules.save(rule);
    return rule;
  }

  /**
   * Toggles whether a rule is actively applied.
   */
  async toggleRuleActive(id: ID, active: boolean): Promise<CategorizationRule> {
    const rule = await this.uow.categorizationRules.getById(id);
    if (!rule) {
      throw new FinanceError(`Rule ${id} not found`, "NOT_FOUND");
    }

    const updated: CategorizationRule = {
      ...rule,
      isActive: active,
      updatedAt: new Date().toISOString(),
    };

    await this.uow.categorizationRules.save(updated);
    return updated;
  }

  async deleteRule(id: ID): Promise<void> {
    const rule = await this.uow.categorizationRules.getById(id);
    if (!rule) {
      throw new FinanceError(`Rule ${id} not found`, "NOT_FOUND");
    }
    if (rule.isSystem) {
      throw new FinanceError("System default rules cannot be deleted; you can deactivate them instead.", "INVALID_OPERATION");
    }
    await this.uow.categorizationRules.delete(id);
  }

  async getAllRules(): Promise<CategorizationRule[]> {
    return this.uow.categorizationRules.getAll(false);
  }
}
