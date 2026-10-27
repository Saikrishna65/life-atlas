/**
 * Life Atlas Finance: Domain Models (Phase 1)
 * 
 * Strict TypeScript domain models for an Android-first, local-first personal finance system.
 * Independent of React components, UI frameworks, and storage implementations.
 */

// -----------------------------------------------------------------------------
// Common Primitives
// -----------------------------------------------------------------------------

export type ID = string;
export type ISODateString = string; // e.g. "2026-10-27T11:40:00.000Z"

/**
 * Monetary amount represented in integer paise (1 INR = 100 paise).
 * Using integer arithmetic prevents floating-point inaccuracies.
 * Serialized as a safe number or string across JSON boundaries.
 */
export type Paise = number;

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | string;

// -----------------------------------------------------------------------------
// FinanceAccount
// -----------------------------------------------------------------------------

export type AccountType = "bank" | "cash" | "savings" | "credit" | "other";
export type AccountStatus = "active" | "archived";

export interface AccountMetadata {
  institutionName?: string;
  accountNumberLast4?: string;
  color?: string;
  icon?: string;
  notes?: string;
}

export interface FinanceAccount {
  /** Immutable unique identifier (e.g. "acc_...") */
  id: ID;
  /** User-defined display name (e.g. "HDFC Salary", "Pocket Cash") */
  name: string;
  /** Category of account */
  accountType: AccountType;
  /** ISO currency code, default "INR" */
  currency: CurrencyCode;
  /** Opening balance in integer paise (signed: negative for opening credit card debt) */
  openingBalancePaise: Paise;
  /** Date the opening balance was anchored */
  openingBalanceDate: ISODateString;
  /** Current calculated balance in integer paise based on posted ledger movements */
  currentBalancePaise: Paise;
  /** Optional merchant or banking institution display metadata */
  metadata?: AccountMetadata;
  /** Account lifecycle status */
  status: AccountStatus;
  /** Creation timestamp */
  createdAt: ISODateString;
  /** Last update timestamp */
  updatedAt: ISODateString;
  /** Record schema/mutation version (starts at 1) */
  version: number;
}

// -----------------------------------------------------------------------------
// Transaction
// -----------------------------------------------------------------------------

export type TransactionDirection = "inflow" | "outflow";
export type TransactionStatus = "pending" | "posted" | "reversed";
export type TransactionSource =
  | "manual"
  | "statement_import"
  | "bank_sync"
  | "notification"
  | "receipt";

export interface Transaction {
  /** Immutable unique identifier (e.g. "txn_...") */
  id: ID;
  /** Associated account ID */
  accountId: ID;
  /** Raw or user-provided description */
  description: string;
  /** Optional normalized merchant or payee name */
  merchant?: string;
  /** Absolute monetary amount in integer paise (must be > 0) */
  amountPaise: Paise;
  /** Explicit currency */
  currency: CurrencyCode;
  /** Cash flow direction */
  direction: TransactionDirection;
  /** Lifecycle settlement status */
  status: TransactionStatus;
  /** Optional category reference */
  categoryId?: ID;
  /** Provenance of the record */
  source: TransactionSource;
  /** Optional external identifier from bank or aggregator for idempotency */
  externalId?: string;
  /** Timestamp when the transaction took place in the real world */
  occurredAt: ISODateString;
  /** Optional timestamp when the transaction cleared/posted */
  postedAt?: ISODateString;
  /** Optional group ID linking corresponding legs of an internal transfer */
  transferGroupId?: ID;
  /** Flag marking whether the transaction requires user categorization or review */
  reviewRequired: boolean;
  /** Optional reference to original transaction for refunds, corrections, or reversals */
  originalTransactionId?: ID;
  /** User notes */
  notes?: string;
  /** Tags for custom filtering */
  tags?: string[];
  /** Creation timestamp */
  createdAt: ISODateString;
  /** Last modification timestamp */
  updatedAt: ISODateString;
  /** Record mutation version */
  version: number;
}

// -----------------------------------------------------------------------------
// FinanceCategory
// -----------------------------------------------------------------------------

export type CategoryType = "expense" | "income" | "transfer";

export interface FinanceCategory {
  /** Immutable unique identifier (e.g. "cat_...") */
  id: ID;
  /** Display label */
  name: string;
  /** Icon identifier from lucide */
  icon: string;
  /** Hex or Tailwind color token */
  color: string;
  /** Category accounting type */
  type: CategoryType;
  /** Optional parent category ID for subcategories */
  parentId?: ID;
  /** Whether this is a non-deletable default system category */
  isSystem: boolean;
  /** Optional default monthly target/budget in paise */
  budgetAmountPaise?: Paise;
  /** Visual display sort order */
  sortOrder: number;
  /** Creation timestamp */
  createdAt: ISODateString;
  /** Last update timestamp */
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// LedgerEntry (Balanced Double-Entry Postings)
// -----------------------------------------------------------------------------

export type LedgerPostingType = "debit" | "credit";

export interface LedgerEntry {
  /** Immutable entry ID */
  id: ID;
  /** Parent transaction ID */
  transactionId: ID;
  /** Target account */
  accountId: ID;
  /** Debit increases assets / reduces liabilities; Credit reduces assets / increases liabilities */
  type: LedgerPostingType;
  /** Positive integer paise */
  amountPaise: Paise;
  /** Currency */
  currency: CurrencyCode;
  /** Effective settlement date */
  effectiveDate: ISODateString;
  /** Memo description */
  description: string;
  /** Creation timestamp */
  createdAt: ISODateString;
}

// -----------------------------------------------------------------------------
// Budget
// -----------------------------------------------------------------------------

export type BudgetPeriod = "monthly" | "weekly" | "custom";

export interface Budget {
  id: ID;
  name: string;
  period: BudgetPeriod;
  startDate: ISODateString;
  endDate: ISODateString;
  /** Mapping of categoryId -> allocated amount in paise */
  categoryAllocations: Record<ID, Paise>;
  /** Total sum of all allocations in paise */
  totalAllocatedPaise: Paise;
  /** Whether unspent budget rolls over to the next period */
  rolloverEnabled: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  version: number;
}

// -----------------------------------------------------------------------------
// SavingsGoal
// -----------------------------------------------------------------------------

export type SavingsGoalStatus = "in_progress" | "reached" | "abandoned";

export interface SavingsGoal {
  id: ID;
  name: string;
  targetAmountPaise: Paise;
  currentAmountPaise: Paise;
  targetDate?: ISODateString;
  linkedAccountId?: ID;
  color?: string;
  icon?: string;
  status: SavingsGoalStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  version: number;
}

// -----------------------------------------------------------------------------
// CategorizationRule
// -----------------------------------------------------------------------------

export type RuleMatchType = "exact" | "contains" | "starts_with" | "regex";

export interface CategorizationRule {
  id: ID;
  name: string;
  /** Match type: exact merchant, contains keyword, starts_with prefix, or safe regex */
  matchType: RuleMatchType;
  /** Normalized pattern or keyword to match against merchant/description */
  pattern: string;
  /** Target category ID */
  categoryId: ID;
  /** Optional transaction direction constraint */
  direction?: TransactionDirection;
  /** Priority order: lower numbers evaluated first (e.g. 10 before 100) */
  priority: number;
  /** System-seeded default rule vs custom user rule */
  isSystem: boolean;
  /** Whether the rule is currently active */
  isActive: boolean;
  /** Human-readable explanation of why this rule exists */
  explanation?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// RecurringRule
// -----------------------------------------------------------------------------

export type RecurringFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
export type RecurringStatus = "detected" | "confirmed" | "dismissed" | "paused";

export interface RecurringRule {
  id: ID;
  accountId: ID;
  categoryId?: ID;
  amountPaise: Paise;
  currency: CurrencyCode;
  direction: TransactionDirection;
  merchant?: string;
  description: string;
  frequency: RecurringFrequency;
  interval: number; // e.g. every 1 month, every 2 weeks
  startDate: ISODateString;
  nextDueDate: ISODateString;
  endDate?: ISODateString;
  lastGeneratedDate?: ISODateString;
  autoPost: boolean;
  /** Recurring lifecycle status */
  status: RecurringStatus;
  /** Detection confidence score from 0.0 to 1.0 */
  confidenceScore?: number;
  /** Transaction IDs that served as historical evidence */
  evidenceTransactionIds?: ID[];
  /** Expected amount range for variable recurring expenses (e.g. utility bills) */
  expectedMinAmountPaise?: Paise;
  expectedMaxAmountPaise?: Paise;
  /** Human-readable explanation of detected pattern */
  explanation?: string;
  /** Indicates that nextDueDate and amount are estimated from history */
  isEstimate?: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// TransactionMatch (Deduplication & Reconciliation)
// -----------------------------------------------------------------------------

export type MatchRuleType = "exact_external_id" | "amount_date_account" | "fuzzy_merchant";
export type MatchStatus = "candidate" | "confirmed" | "dismissed";

export interface TransactionMatch {
  id: ID;
  sourceTransactionId: ID;
  matchedTransactionId: ID;
  confidenceScore: number; // 0.0 to 1.0
  matchRule: MatchRuleType;
  status: MatchStatus;
  createdAt: ISODateString;
}

// -----------------------------------------------------------------------------
// SyncOperation (Local Change Outbox for Future Synchronization)
// -----------------------------------------------------------------------------

export type SyncEntityType = "account" | "transaction" | "category" | "goal" | "budget" | "rule" | "recurring";
export type SyncAction = "create" | "update" | "delete";
export type SyncStatus = "pending" | "in_progress" | "synced" | "failed_retryable" | "failed_permanent" | "failed";

export interface SyncOperation {
  id: ID;
  entityType: SyncEntityType;
  entityId: ID;
  action: SyncAction;
  payloadJson: string;
  timestamp: ISODateString;
  status: SyncStatus;
  retryCount: number;
  lastError?: string;
  idempotencyKey: string;
  /** Lease token when claimed by an active sync worker */
  claimToken?: string;
  /** Timestamp when lease was claimed */
  claimedAt?: ISODateString;
  /** Earliest time when next retry can occur under exponential backoff */
  nextRetryAt?: ISODateString;
}

// -----------------------------------------------------------------------------
// SyncConflict (Conflict Staging & Resolution)
// -----------------------------------------------------------------------------

export type ConflictResolutionType = "client_wins" | "server_wins" | "manual_merge" | "unresolved";

export interface SyncConflict {
  id: ID;
  operationId: ID;
  entityType: SyncEntityType;
  entityId: ID;
  localPayloadJson: string;
  remotePayloadJson: string;
  resolution: ConflictResolutionType;
  resolvedPayloadJson?: string;
  resolvedAt?: ISODateString;
  createdAt: ISODateString;
}

// -----------------------------------------------------------------------------
// Cash-Flow Forecasting & Runway Projections
// -----------------------------------------------------------------------------

export type ForecastHorizon = "7_days" | "30_days" | "90_days" | "12_months";
export type DataQualityRating = "insufficient_history" | "limited_history" | "reasonable_coverage" | "user_adjusted_scenario";

export interface ProjectedCashFlowPoint {
  date: ISODateString;
  projectedBalancePaise: Paise;
  expectedInflowPaise: Paise;
  expectedOutflowPaise: Paise;
  obligationDescriptions?: string[];
}

export interface UpcomingObligation {
  ruleId: ID;
  merchantOrDescription: string;
  amountPaise: Paise;
  direction: TransactionDirection;
  frequency: RecurringFrequency;
  dueDate: ISODateString;
  categoryId?: ID;
  isEstimate: boolean;
}

export interface CashFlowForecast {
  horizon: ForecastHorizon;
  startDate: ISODateString;
  endDate: ISODateString;
  startingLiquidPaise: Paise;
  projectedLiquidPaise: Paise;
  expectedIncomePaise: Paise;
  expectedExpensePaise: Paise;
  projectedNetCashFlowPaise: Paise;
  dailyBurnRatePaise: Paise;
  lowestProjectedBalancePaise: Paise;
  lowBalanceDate?: ISODateString;
  upcomingObligations: UpcomingObligation[];
  dailyPoints: ProjectedCashFlowPoint[];
  dataQuality: DataQualityRating;
  dataQualityExplanation: string;
}

export interface RunwayEstimate {
  currentLiquidAssetsPaise: Paise;
  reserveThresholdPaise: Paise;
  availableAboveReservePaise: Paise;
  monthlyBurnRatePaise: Paise;
  dailyBurnRatePaise: Paise;
  runwayDays: number | null; // null if in surplus (income >= expenses)
  runwayMonths: number | null;
  status: "surplus" | "stable" | "warning" | "critical" | "depleted" | "insufficient_data";
  explanation: string;
  scenarios: {
    baseline: { runwayDays: number | null; monthlyBurnPaise: Paise };
    conservative: { runwayDays: number | null; monthlyBurnPaise: Paise }; // +20% expenses, -10% income
    frugal: { runwayDays: number | null; monthlyBurnPaise: Paise }; // -20% discretionary
  };
}

export interface CategoryBudgetProjection {
  categoryId: ID;
  categoryName: string;
  allocatedPaise: Paise;
  spentSoFarPaise: Paise;
  projectedEndOfMonthPaise: Paise;
  remainingBudgetPaise: Paise;
  utilizationPercent: number;
  projectedUtilizationPercent: number;
  riskLevel: "normal" | "approaching" | "over_budget";
  daysRemainingInPeriod: number;
}

export interface ScenarioPlanOptions {
  discretionaryCutPercent?: number; // e.g. 20 (meaning 20% reduction)
  plannedOneOffExpenses?: {
    date: ISODateString;
    amountPaise: Paise;
    description: string;
  }[];
  incomeAdjustmentPaise?: Paise; // +/- adjustment
}

// -----------------------------------------------------------------------------
// SyncCursor & BankConnection Metadata
// -----------------------------------------------------------------------------

export interface SyncCursor {
  id: ID;
  provider: string;
  cursor: string;
  lastSyncedAt: ISODateString;
  status: string;
}

export type ConnectionType = "aggregator" | "account_aggregator_in" | "manual_import";
export type SyncConnectionStatus = "idle" | "in_progress" | "success" | "error";

export interface BankConnection {
  id: ID;
  institutionId: string;
  institutionName: string;
  accountIds: ID[];
  connectionType: ConnectionType;
  consentId?: string;
  consentExpiresAt?: ISODateString;
  lastSyncStatus: SyncConnectionStatus;
  lastSyncAt?: ISODateString;
  errorMessage?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// -----------------------------------------------------------------------------
// AuditEvent (Financial Audit Trail)
// -----------------------------------------------------------------------------

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "correct"
  | "reverse"
  | "archive";

export interface FieldChange {
  oldVal: unknown;
  newVal: unknown;
}

export interface AuditEvent {
  id: ID;
  entityType: "account" | "transaction" | "category" | "goal" | "budget" | "rule" | "recurring";
  entityId: ID;
  action: AuditAction;
  changes: Record<string, FieldChange>;
  reason?: string;
  performedAt: ISODateString;
}

