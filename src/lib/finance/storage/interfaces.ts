/**
 * Life Atlas Finance: Storage & Repository Interfaces
 * 
 * Defines persistence contracts so domain and application services remain strictly decoupled
 * from IndexedDB, native SQLite, or cloud backends.
 */

import {
  FinanceAccount,
  Transaction,
  FinanceCategory,
  SavingsGoal,
  Budget,
  CategorizationRule,
  RecurringRule,
  RecurringStatus,
  AuditEvent,
  SyncOperation,
  SyncStatus,
  SyncConflict,
  ConflictResolutionType,
  ID,
  ISODateString,
  AccountStatus,
} from "../domain/models";

export interface TransactionFilterOptions {
  accountId?: ID;
  accountIds?: ID[];
  categoryId?: ID;
  categoryIds?: ID[];
  startDate?: ISODateString;
  endDate?: ISODateString;
  status?: "pending" | "posted" | "reversed";
  direction?: "inflow" | "outflow";
  source?: string;
  transferGroupId?: ID;
  searchQuery?: string;
  minAmountPaise?: number;
  maxAmountPaise?: number;
  limit?: number;
  offset?: number;
}

export interface IFinanceAccountRepository {
  getById(id: ID): Promise<FinanceAccount | null>;
  getAll(status?: AccountStatus): Promise<FinanceAccount[]>;
  save(account: FinanceAccount): Promise<void>;
  updateBalance(id: ID, newBalancePaise: number): Promise<void>;
  archive(id: ID): Promise<void>;
  delete(id: ID): Promise<void>;
}

export interface ITransactionRepository {
  getById(id: ID): Promise<Transaction | null>;
  getByExternalId(externalId: string): Promise<Transaction | null>;
  getByTransferGroupId(transferGroupId: ID): Promise<Transaction[]>;
  query(filters: TransactionFilterOptions): Promise<Transaction[]>;
  count(filters: TransactionFilterOptions): Promise<number>;
  save(transaction: Transaction): Promise<void>;
  saveBatch(transactions: Transaction[]): Promise<void>;
  delete(id: ID): Promise<void>;
}

export interface IFinanceCategoryRepository {
  getById(id: ID): Promise<FinanceCategory | null>;
  getAll(): Promise<FinanceCategory[]>;
  save(category: FinanceCategory): Promise<void>;
  delete(id: ID): Promise<void>;
  seedDefaults(): Promise<void>;
}

export interface ISavingsGoalRepository {
  getById(id: ID): Promise<SavingsGoal | null>;
  getAll(): Promise<SavingsGoal[]>;
  save(goal: SavingsGoal): Promise<void>;
  delete(id: ID): Promise<void>;
}

export interface IBudgetRepository {
  getById(id: ID): Promise<Budget | null>;
  getAll(): Promise<Budget[]>;
  getByPeriod(period: string, startDate?: string): Promise<Budget[]>;
  save(budget: Budget): Promise<void>;
  delete(id: ID): Promise<void>;
}

export interface ICategorizationRuleRepository {
  getById(id: ID): Promise<CategorizationRule | null>;
  getAll(activeOnly?: boolean): Promise<CategorizationRule[]>;
  getByCategory(categoryId: ID): Promise<CategorizationRule[]>;
  save(rule: CategorizationRule): Promise<void>;
  delete(id: ID): Promise<void>;
  seedDefaults(): Promise<void>;
}

export interface IRecurringRuleRepository {
  getById(id: ID): Promise<RecurringRule | null>;
  getAll(status?: RecurringStatus): Promise<RecurringRule[]>;
  getByAccount(accountId: ID): Promise<RecurringRule[]>;
  save(rule: RecurringRule): Promise<void>;
  delete(id: ID): Promise<void>;
}

export interface IAuditRepository {
  record(event: AuditEvent): Promise<void>;
  getByEntity(entityType: string, entityId: ID): Promise<AuditEvent[]>;
  getAll(limit?: number): Promise<AuditEvent[]>;
}

export interface ISyncOutboxRepository {
  enqueue(operation: SyncOperation): Promise<void>;
  getById(id: ID): Promise<SyncOperation | null>;
  getAll(status?: SyncStatus): Promise<SyncOperation[]>;
  getPending(limit?: number): Promise<SyncOperation[]>;
  claimPending(claimToken: string, limit?: number): Promise<SyncOperation[]>;
  markSynced(id: ID): Promise<void>;
  markFailed(id: ID, error: string): Promise<void>;
  markFailedRetryable(id: ID, error: string, nextRetryAt: string): Promise<void>;
  markFailedPermanent(id: ID, error: string): Promise<void>;
  releaseStaleClaims(timeoutMs?: number): Promise<number>;
  retryFailed(): Promise<number>;
  clearCompleted(): Promise<void>;
}

export interface ISyncConflictRepository {
  getById(id: ID): Promise<SyncConflict | null>;
  getAll(unresolvedOnly?: boolean): Promise<SyncConflict[]>;
  save(conflict: SyncConflict): Promise<void>;
  resolve(id: ID, resolution: ConflictResolutionType, resolvedPayloadJson?: string): Promise<void>;
  delete(id: ID): Promise<void>;
}

/**
 * Unit of Work interface for atomic transactional persistence operations
 */
export interface IUnitOfWork {
  accounts: IFinanceAccountRepository;
  transactions: ITransactionRepository;
  categories: IFinanceCategoryRepository;
  savingsGoals: ISavingsGoalRepository;
  budgets: IBudgetRepository;
  categorizationRules: ICategorizationRuleRepository;
  recurringRules: IRecurringRuleRepository;
  conflicts: ISyncConflictRepository;
  audit: IAuditRepository;
  outbox: ISyncOutboxRepository;

  /**
   * Executes a callback within an isolated atomic transaction boundary
   */
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}

