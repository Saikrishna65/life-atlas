/**
 * Life Atlas Finance: Future Integration Contracts & Infrastructure Interfaces
 * 
 * Defines clean boundary contracts for subsequent phases:
 * - Bank Transaction Aggregators (RBI Account Aggregator framework / Plaid / Setu)
 * - Statement Import Parsers (PDF, CSV, OFX)
 * - Android SMS & Notification Capture
 * - Merchant Categorization & Machine Learning Rules
 * - Recurring Transaction Detection Engine
 * - Cloud Synchronization & Conflict Resolution
 * 
 * NOTE: These are strictly typed contracts without fake mock data or unauthorized scrapers.
 */

import {
  Transaction,
  FinanceAccount,
  ID,
  Paise,
  TransactionDirection,
  CurrencyCode,
} from "../domain/models";

// -----------------------------------------------------------------------------
// 1. Bank Aggregator & Account Aggregator (AA) Integration Boundary
// -----------------------------------------------------------------------------

export interface BankInstitution {
  id: string;
  name: string;
  logoUrl?: string;
  supportsAccountAggregator: boolean;
  supportedAccountTypes: ("savings" | "current" | "credit" | "term_deposit")[];
}

export interface BankConsentRequest {
  institutionId: string;
  userVpaOrHandle: string;
  dataRangeDays: number;
  scopes: ("ACCOUNTS" | "TRANSACTIONS" | "BALANCE")[];
}

export interface BankConsentSession {
  consentId: string;
  consentHandle: string;
  redirectUrl?: string;
  expiresAt: string;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "REVOKED";
}

export interface NormalizedBankTransaction {
  externalId: string;
  description: string;
  merchantName?: string;
  amountPaise: Paise;
  currency: CurrencyCode;
  direction: TransactionDirection;
  occurredAt: string;
  postedAt?: string;
  accountReferenceLast4?: string;
  referenceNumber?: string;
  upiId?: string;
}

export interface IBankSyncProvider {
  getProviderName(): string;
  listInstitutions(): Promise<BankInstitution[]>;
  initiateConsent(request: BankConsentRequest): Promise<BankConsentSession>;
  checkConsentStatus(consentId: string): Promise<BankConsentSession>;
  fetchAccounts(consentId: string): Promise<Partial<FinanceAccount>[]>;
  fetchTransactions(
    consentId: string,
    accountExternalId: string,
    cursor?: string
  ): Promise<{
    transactions: NormalizedBankTransaction[];
    nextCursor?: string;
    hasMore: boolean;
  }>;
}

// -----------------------------------------------------------------------------
// 2. Statement Import Parsers (PDF, CSV, OFX, Excel)
// -----------------------------------------------------------------------------

export type StatementFileType = "pdf" | "csv" | "ofx" | "qif" | "xlsx";

export interface StatementParseResult {
  detectedBank?: string;
  accountNumberMasked?: string;
  statementPeriodStart?: string;
  statementPeriodEnd?: string;
  closingBalancePaise?: Paise;
  transactions: NormalizedBankTransaction[];
  parsingErrors: { line?: number; error: string }[];
  confidenceScore: number; // 0.0 - 1.0
}

export interface IStatementParser {
  supportsFileType(fileType: StatementFileType): boolean;
  parse(fileBytes: ArrayBuffer, options?: { password?: string }): Promise<StatementParseResult>;
}

// -----------------------------------------------------------------------------
// 3. Android SMS & Push Notification Capture
// -----------------------------------------------------------------------------

export interface CapturedNotificationEvent {
  packageName: string; // e.g. "com.google.android.apps.nbu.paisa.user", "com.phonepe.app"
  sender: string; // e.g. "HDFCBK", "SBIINB", "ICICIB"
  bodyText: string;
  timestamp: string;
}

export interface INotificationCaptureEngine {
  isSupportedOnCurrentPlatform(): boolean;
  requestNotificationPermissions(): Promise<boolean>;
  parseNotification(event: CapturedNotificationEvent): NormalizedBankTransaction | null;
}

// -----------------------------------------------------------------------------
// 4. Merchant Categorization & Intelligence Engine
// -----------------------------------------------------------------------------

export interface CategorizationResult {
  categoryId: ID;
  categoryName: string;
  confidence: number; // 0.0 - 1.0
  ruleMatched?: string;
  normalizedMerchant?: string;
}

export interface ICategorizationEngine {
  categorize(transaction: Partial<Transaction>): Promise<CategorizationResult | null>;
  learnUserCorrection(transactionId: ID, userAssignedCategoryId: ID): Promise<void>;
}

// -----------------------------------------------------------------------------
// 5. Recurring Transaction Detector
// -----------------------------------------------------------------------------

export interface DetectedRecurringPattern {
  merchantOrDescription: string;
  estimatedAmountPaise: Paise;
  frequency: "weekly" | "monthly" | "yearly";
  confidenceScore: number;
  sampleTransactionIds: ID[];
  nextEstimatedDate: string;
}

export interface IRecurringDetector {
  detectRecurringPatterns(transactions: Transaction[]): Promise<DetectedRecurringPattern[]>;
}

// -----------------------------------------------------------------------------
// 6. Secure Cloud Synchronization & Conflict Resolution
// -----------------------------------------------------------------------------

export type ConflictResolutionStrategy = "client_wins" | "server_wins" | "manual_merge";

export interface SyncPayload {
  lastSyncTimestamp: string;
  clientVersion: number;
  mutations: {
    entityType: string;
    entityId: string;
    action: "create" | "update" | "delete";
    payload: unknown;
    timestamp: string;
  }[];
}

export interface ILegacyCloudSyncAdapter {
  pushMutations(payload: SyncPayload): Promise<{ acknowledgedIds: string[] }>;
  pullChanges(sinceTimestamp: string): Promise<SyncPayload>;
  resolveConflict(
    clientEntity: unknown,
    serverEntity: unknown,
    strategy: ConflictResolutionStrategy
  ): unknown;
}

