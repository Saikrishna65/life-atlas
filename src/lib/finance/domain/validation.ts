/**
 * Life Atlas Finance: Runtime Schema Validation & Type Guards
 * 
 * Enforces business rules and invariant constraints at domain and persistence boundaries
 * without external heavy libraries, preserving zero runtime bloat.
 */

import { FinanceError } from "./errors";
import {
  FinanceAccount,
  Transaction,
  FinanceCategory,
  LedgerEntry,
  Budget,
  SavingsGoal,
  CategorizationRule,
  RecurringRule,
  RuleMatchType,
  RecurringFrequency,
  RecurringStatus,
  SyncOperation,
  SyncConflict,
  AuditEvent,
  AccountType,
  AccountStatus,
  TransactionDirection,
  TransactionStatus,
  TransactionSource,
} from "./models";
import { isSafePaise } from "./money";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z?)?/;

export function isValidISODate(str: unknown): str is string {
  if (typeof str !== "string") return false;
  return ISO_DATE_REGEX.test(str) && !Number.isNaN(Date.parse(str));
}

// -----------------------------------------------------------------------------
// Account Validation
// -----------------------------------------------------------------------------

const VALID_ACCOUNT_TYPES: ReadonlySet<AccountType> = new Set([
  "bank",
  "cash",
  "savings",
  "credit",
  "other",
]);

const VALID_ACCOUNT_STATUSES: ReadonlySet<AccountStatus> = new Set([
  "active",
  "archived",
]);

export function validateFinanceAccount(account: unknown): FinanceAccount {
  if (!account || typeof account !== "object") {
    throw new FinanceError("Account record must be a non-null object", "VALIDATION_FAILED");
  }

  const a = account as Partial<FinanceAccount>;

  if (!a.id || typeof a.id !== "string" || !a.id.trim()) {
    throw new FinanceError("Account ID must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!a.name || typeof a.name !== "string" || !a.name.trim()) {
    throw new FinanceError("Account name must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!a.accountType || !VALID_ACCOUNT_TYPES.has(a.accountType)) {
    throw new FinanceError(
      `Invalid account type: "${String(a.accountType)}". Valid types: ${Array.from(VALID_ACCOUNT_TYPES).join(", ")}`,
      "VALIDATION_FAILED"
    );
  }

  if (!a.currency || typeof a.currency !== "string" || !a.currency.trim()) {
    throw new FinanceError("Account currency must be specified", "VALIDATION_FAILED");
  }

  if (!isSafePaise(a.openingBalancePaise)) {
    throw new FinanceError("Account openingBalancePaise must be a safe integer", "VALIDATION_FAILED");
  }

  if (!isValidISODate(a.openingBalanceDate)) {
    throw new FinanceError("Account openingBalanceDate must be a valid ISO date", "VALIDATION_FAILED");
  }

  if (!isSafePaise(a.currentBalancePaise)) {
    throw new FinanceError("Account currentBalancePaise must be a safe integer", "VALIDATION_FAILED");
  }

  if (!a.status || !VALID_ACCOUNT_STATUSES.has(a.status)) {
    throw new FinanceError("Account status must be 'active' or 'archived'", "VALIDATION_FAILED");
  }

  if (!isValidISODate(a.createdAt)) {
    throw new FinanceError("Account createdAt must be a valid ISO date", "VALIDATION_FAILED");
  }

  if (!isValidISODate(a.updatedAt)) {
    throw new FinanceError("Account updatedAt must be a valid ISO date", "VALIDATION_FAILED");
  }

  if (typeof a.version !== "number" || a.version < 1) {
    throw new FinanceError("Account version must be an integer >= 1", "VALIDATION_FAILED");
  }

  return a as FinanceAccount;
}

// -----------------------------------------------------------------------------
// Transaction Validation
// -----------------------------------------------------------------------------

const VALID_DIRECTIONS: ReadonlySet<TransactionDirection> = new Set(["inflow", "outflow"]);
const VALID_TXN_STATUSES: ReadonlySet<TransactionStatus> = new Set(["pending", "posted", "reversed"]);
const VALID_SOURCES: ReadonlySet<TransactionSource> = new Set([
  "manual",
  "statement_import",
  "bank_sync",
  "notification",
  "receipt",
]);

export function validateTransaction(txn: unknown): Transaction {
  if (!txn || typeof txn !== "object") {
    throw new FinanceError("Transaction record must be a non-null object", "VALIDATION_FAILED");
  }

  const t = txn as Partial<Transaction>;

  if (!t.id || typeof t.id !== "string" || !t.id.trim()) {
    throw new FinanceError("Transaction ID must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!t.accountId || typeof t.accountId !== "string" || !t.accountId.trim()) {
    throw new FinanceError("Transaction accountId must be specified", "VALIDATION_FAILED");
  }

  if (typeof t.description !== "string" || !t.description.trim()) {
    throw new FinanceError("Transaction description must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!isSafePaise(t.amountPaise) || t.amountPaise <= 0) {
    throw new FinanceError(
      `Transaction amountPaise must be a strictly positive safe integer. Received: ${String(t.amountPaise)}`,
      "INVALID_AMOUNT"
    );
  }

  if (!t.currency || typeof t.currency !== "string") {
    throw new FinanceError("Transaction currency must be a valid code", "VALIDATION_FAILED");
  }

  if (!t.direction || !VALID_DIRECTIONS.has(t.direction)) {
    throw new FinanceError("Transaction direction must be 'inflow' or 'outflow'", "VALIDATION_FAILED");
  }

  if (!t.status || !VALID_TXN_STATUSES.has(t.status)) {
    throw new FinanceError("Transaction status must be 'pending', 'posted', or 'reversed'", "VALIDATION_FAILED");
  }

  if (!t.source || !VALID_SOURCES.has(t.source)) {
    throw new FinanceError(`Invalid transaction source: "${String(t.source)}"`, "VALIDATION_FAILED");
  }

  if (!isValidISODate(t.occurredAt)) {
    throw new FinanceError("Transaction occurredAt must be a valid ISO date string", "VALIDATION_FAILED");
  }

  if (t.postedAt !== undefined && !isValidISODate(t.postedAt)) {
    throw new FinanceError("Transaction postedAt must be a valid ISO date string when specified", "VALIDATION_FAILED");
  }

  if (typeof t.reviewRequired !== "boolean") {
    throw new FinanceError("Transaction reviewRequired must be boolean", "VALIDATION_FAILED");
  }

  if (!isValidISODate(t.createdAt)) {
    throw new FinanceError("Transaction createdAt must be a valid ISO date", "VALIDATION_FAILED");
  }

  if (!isValidISODate(t.updatedAt)) {
    throw new FinanceError("Transaction updatedAt must be a valid ISO date", "VALIDATION_FAILED");
  }

  if (typeof t.version !== "number" || t.version < 1) {
    throw new FinanceError("Transaction version must be an integer >= 1", "VALIDATION_FAILED");
  }

  return t as Transaction;
}

// -----------------------------------------------------------------------------
// Category Validation
// -----------------------------------------------------------------------------

export function validateFinanceCategory(cat: unknown): FinanceCategory {
  if (!cat || typeof cat !== "object") {
    throw new FinanceError("Category record must be a non-null object", "VALIDATION_FAILED");
  }

  const c = cat as Partial<FinanceCategory>;

  if (!c.id || typeof c.id !== "string") {
    throw new FinanceError("Category ID must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!c.name || typeof c.name !== "string" || !c.name.trim()) {
    throw new FinanceError("Category name must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!c.type || (c.type !== "expense" && c.type !== "income" && c.type !== "transfer")) {
    throw new FinanceError("Category type must be 'expense', 'income', or 'transfer'", "VALIDATION_FAILED");
  }

  if (c.budgetAmountPaise !== undefined && !isSafePaise(c.budgetAmountPaise)) {
    throw new FinanceError("Category budgetAmountPaise must be safe integer paise", "VALIDATION_FAILED");
  }

  return c as FinanceCategory;
}

// -----------------------------------------------------------------------------
// SavingsGoal Validation
// -----------------------------------------------------------------------------

export function validateSavingsGoal(goal: unknown): SavingsGoal {
  if (!goal || typeof goal !== "object") {
    throw new FinanceError("SavingsGoal record must be a non-null object", "VALIDATION_FAILED");
  }

  const g = goal as Partial<SavingsGoal>;

  if (!g.id || typeof g.id !== "string") {
    throw new FinanceError("SavingsGoal ID must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!g.name || typeof g.name !== "string" || !g.name.trim()) {
    throw new FinanceError("SavingsGoal name must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!isSafePaise(g.targetAmountPaise) || g.targetAmountPaise <= 0) {
    throw new FinanceError("SavingsGoal targetAmountPaise must be a positive integer", "VALIDATION_FAILED");
  }

  if (!isSafePaise(g.currentAmountPaise) || g.currentAmountPaise < 0) {
    throw new FinanceError("SavingsGoal currentAmountPaise must be non-negative integer paise", "VALIDATION_FAILED");
  }

  if (!g.status || (g.status !== "in_progress" && g.status !== "reached" && g.status !== "abandoned")) {
    throw new FinanceError("SavingsGoal status must be 'in_progress', 'reached', or 'abandoned'", "VALIDATION_FAILED");
  }

  return g as SavingsGoal;
}

export function validateBudget(budget: unknown): Budget {
  if (!budget || typeof budget !== "object") {
    throw new FinanceError("Budget record must be a non-null object", "VALIDATION_FAILED");
  }

  const b = budget as Partial<Budget>;

  if (!b.id || typeof b.id !== "string") {
    throw new FinanceError("Budget ID must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!b.name || typeof b.name !== "string" || !b.name.trim()) {
    throw new FinanceError("Budget name must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!b.period || (b.period !== "monthly" && b.period !== "weekly" && b.period !== "custom")) {
    throw new FinanceError("Budget period must be 'monthly', 'weekly', or 'custom'", "VALIDATION_FAILED");
  }

  if (!isValidISODate(b.startDate) || !isValidISODate(b.endDate)) {
    throw new FinanceError("Budget startDate and endDate must be valid ISO date strings", "VALIDATION_FAILED");
  }

  if (!isSafePaise(b.totalAllocatedPaise) || b.totalAllocatedPaise < 0) {
    throw new FinanceError("Budget totalAllocatedPaise must be a non-negative safe integer", "VALIDATION_FAILED");
  }

  if (typeof b.categoryAllocations !== "object" || b.categoryAllocations === null) {
    throw new FinanceError("Budget categoryAllocations must be an object", "VALIDATION_FAILED");
  }

  return b as Budget;
}

// -----------------------------------------------------------------------------
// LedgerEntry Validation
// -----------------------------------------------------------------------------

export function validateLedgerEntry(entry: unknown): LedgerEntry {
  if (!entry || typeof entry !== "object") {
    throw new FinanceError("LedgerEntry must be a non-null object", "VALIDATION_FAILED");
  }

  const e = entry as Partial<LedgerEntry>;

  if (!e.id || typeof e.id !== "string") {
    throw new FinanceError("LedgerEntry id must be a string", "VALIDATION_FAILED");
  }

  if (!e.transactionId || typeof e.transactionId !== "string") {
    throw new FinanceError("LedgerEntry transactionId must be a string", "VALIDATION_FAILED");
  }

  if (!e.accountId || typeof e.accountId !== "string") {
    throw new FinanceError("LedgerEntry accountId must be a string", "VALIDATION_FAILED");
  }

  if (e.type !== "debit" && e.type !== "credit") {
    throw new FinanceError("LedgerEntry type must be 'debit' or 'credit'", "VALIDATION_FAILED");
  }

  if (!isSafePaise(e.amountPaise) || e.amountPaise <= 0) {
    throw new FinanceError("LedgerEntry amountPaise must be a positive safe integer", "VALIDATION_FAILED");
  }

  return e as LedgerEntry;
}

// -----------------------------------------------------------------------------
// CategorizationRule Validation
// -----------------------------------------------------------------------------

const VALID_MATCH_TYPES: ReadonlySet<RuleMatchType> = new Set([
  "exact",
  "contains",
  "starts_with",
  "regex",
]);

export function validateCategorizationRule(rule: unknown): CategorizationRule {
  if (!rule || typeof rule !== "object") {
    throw new FinanceError("Categorization rule must be a non-null object", "VALIDATION_FAILED");
  }

  const r = rule as Partial<CategorizationRule>;

  if (!r.id || typeof r.id !== "string" || !r.id.trim()) {
    throw new FinanceError("Rule ID must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!r.name || typeof r.name !== "string" || !r.name.trim()) {
    throw new FinanceError("Rule name must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!r.matchType || !VALID_MATCH_TYPES.has(r.matchType)) {
    throw new FinanceError(`Invalid match type: ${String(r.matchType)}`, "VALIDATION_FAILED");
  }

  if (!r.pattern || typeof r.pattern !== "string" || !r.pattern.trim()) {
    throw new FinanceError("Rule pattern must be a non-empty string", "VALIDATION_FAILED");
  }

  if (r.matchType === "regex") {
    try {
      new RegExp(r.pattern, "i");
    } catch {
      throw new FinanceError(`Invalid regular expression pattern: "${r.pattern}"`, "VALIDATION_FAILED");
    }
  }

  if (!r.categoryId || typeof r.categoryId !== "string" || !r.categoryId.trim()) {
    throw new FinanceError("Rule target categoryId must be specified", "VALIDATION_FAILED");
  }

  if (r.direction && r.direction !== "inflow" && r.direction !== "outflow") {
    throw new FinanceError("Rule direction must be 'inflow' or 'outflow' if provided", "VALIDATION_FAILED");
  }

  if (typeof r.priority !== "number" || r.priority < 0) {
    throw new FinanceError("Rule priority must be a non-negative number", "VALIDATION_FAILED");
  }

  return r as CategorizationRule;
}

// -----------------------------------------------------------------------------
// RecurringRule Validation
// -----------------------------------------------------------------------------

const VALID_RECURRING_FREQUENCIES: ReadonlySet<RecurringFrequency> = new Set([
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
]);

const VALID_RECURRING_STATUSES: ReadonlySet<RecurringStatus> = new Set([
  "detected",
  "confirmed",
  "dismissed",
  "paused",
]);

export function validateRecurringRule(rule: unknown): RecurringRule {
  if (!rule || typeof rule !== "object") {
    throw new FinanceError("Recurring rule must be a non-null object", "VALIDATION_FAILED");
  }

  const r = rule as Partial<RecurringRule>;

  if (!r.id || typeof r.id !== "string" || !r.id.trim()) {
    throw new FinanceError("Recurring rule ID must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!r.accountId || typeof r.accountId !== "string" || !r.accountId.trim()) {
    throw new FinanceError("Recurring rule accountId must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!isSafePaise(r.amountPaise) || r.amountPaise <= 0) {
    throw new FinanceError("Recurring rule amountPaise must be a positive safe integer", "VALIDATION_FAILED");
  }

  if (r.direction !== "inflow" && r.direction !== "outflow") {
    throw new FinanceError("Recurring rule direction must be 'inflow' or 'outflow'", "VALIDATION_FAILED");
  }

  if (!r.description || typeof r.description !== "string" || !r.description.trim()) {
    throw new FinanceError("Recurring rule description must be a non-empty string", "VALIDATION_FAILED");
  }

  if (!r.frequency || !VALID_RECURRING_FREQUENCIES.has(r.frequency)) {
    throw new FinanceError(`Invalid recurring frequency: ${String(r.frequency)}`, "VALIDATION_FAILED");
  }

  if (!r.status || !VALID_RECURRING_STATUSES.has(r.status)) {
    throw new FinanceError(`Invalid recurring status: ${String(r.status)}`, "VALIDATION_FAILED");
  }

  if (!isValidISODate(r.startDate)) {
    throw new FinanceError("Recurring rule startDate must be a valid ISO date", "VALIDATION_FAILED");
  }

  if (!isValidISODate(r.nextDueDate)) {
    throw new FinanceError("Recurring rule nextDueDate must be a valid ISO date", "VALIDATION_FAILED");
  }

  return r as RecurringRule;
}

// -----------------------------------------------------------------------------
// SyncOperation & SyncConflict Validation
// -----------------------------------------------------------------------------

const VALID_SYNC_STATUSES = new Set([
  "pending",
  "in_progress",
  "synced",
  "failed_retryable",
  "failed_permanent",
  "failed",
]);

export function validateSyncOperation(op: unknown): SyncOperation {
  if (!op || typeof op !== "object") {
    throw new FinanceError("SyncOperation must be a non-null object", "VALIDATION_FAILED");
  }

  const o = op as Partial<SyncOperation>;
  if (!o.id || typeof o.id !== "string") {
    throw new FinanceError("SyncOperation id must be a string", "VALIDATION_FAILED");
  }
  if (!o.entityType || typeof o.entityType !== "string") {
    throw new FinanceError("SyncOperation entityType must be specified", "VALIDATION_FAILED");
  }
  if (!o.entityId || typeof o.entityId !== "string") {
    throw new FinanceError("SyncOperation entityId must be specified", "VALIDATION_FAILED");
  }
  if (!o.action || (o.action !== "create" && o.action !== "update" && o.action !== "delete")) {
    throw new FinanceError("SyncOperation action must be create, update, or delete", "VALIDATION_FAILED");
  }
  if (typeof o.payloadJson !== "string") {
    throw new FinanceError("SyncOperation payloadJson must be a string", "VALIDATION_FAILED");
  }
  if (!o.status || !VALID_SYNC_STATUSES.has(o.status)) {
    throw new FinanceError(`Invalid sync status: ${String(o.status)}`, "VALIDATION_FAILED");
  }
  if (!o.idempotencyKey || typeof o.idempotencyKey !== "string") {
    throw new FinanceError("SyncOperation idempotencyKey must be a non-empty string", "VALIDATION_FAILED");
  }

  return o as SyncOperation;
}

export function validateSyncConflict(conflict: unknown): SyncConflict {
  if (!conflict || typeof conflict !== "object") {
    throw new FinanceError("SyncConflict must be a non-null object", "VALIDATION_FAILED");
  }

  const c = conflict as Partial<SyncConflict>;
  if (!c.id || typeof c.id !== "string") {
    throw new FinanceError("SyncConflict id must be a string", "VALIDATION_FAILED");
  }
  if (!c.operationId || typeof c.operationId !== "string") {
    throw new FinanceError("SyncConflict operationId must be a string", "VALIDATION_FAILED");
  }
  if (!c.entityType || typeof c.entityType !== "string") {
    throw new FinanceError("SyncConflict entityType must be specified", "VALIDATION_FAILED");
  }
  if (!c.entityId || typeof c.entityId !== "string") {
    throw new FinanceError("SyncConflict entityId must be specified", "VALIDATION_FAILED");
  }

  return c as SyncConflict;
}


