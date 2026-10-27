/**
 * Life Atlas Finance: IndexedDB Unit of Work
 * 
 * Provides coordinated repository access and atomic transaction boundary execution.
 */

import {
  IUnitOfWork,
  IFinanceAccountRepository,
  ITransactionRepository,
  IFinanceCategoryRepository,
  ISavingsGoalRepository,
  IBudgetRepository,
  ICategorizationRuleRepository,
  IRecurringRuleRepository,
  ISyncConflictRepository,
  IAuditRepository,
  ISyncOutboxRepository,
} from "../interfaces";
import { IndexedDBAccountRepository } from "./accountRepo";
import { IndexedDBTransactionRepository } from "./transactionRepo";
import { IndexedDBCategoryRepository } from "./categoryRepo";
import { IndexedDBSavingsGoalRepository } from "./savingsGoalRepo";
import { IndexedDBBudgetRepository } from "./budgetRepo";
import { IndexedDBCategorizationRuleRepository } from "./categorizationRuleRepo";
import { IndexedDBRecurringRuleRepository } from "./recurringRuleRepo";
import { IndexedDBConflictRepository } from "./conflictRepo";
import { IndexedDBAuditRepository } from "./auditRepo";
import { IndexedDBOutboxRepository } from "./outboxRepo";
import { getFinanceDB } from "./database";
import { StorageError } from "../../domain/errors";

export class IndexedDBUnitOfWork implements IUnitOfWork {
  readonly accounts: IFinanceAccountRepository;
  readonly transactions: ITransactionRepository;
  readonly categories: IFinanceCategoryRepository;
  readonly savingsGoals: ISavingsGoalRepository;
  readonly budgets: IBudgetRepository;
  readonly categorizationRules: ICategorizationRuleRepository;
  readonly recurringRules: IRecurringRuleRepository;
  readonly conflicts: ISyncConflictRepository;
  readonly audit: IAuditRepository;
  readonly outbox: ISyncOutboxRepository;

  private dbPromise: Promise<IDBDatabase>;

  constructor(customDbPromise?: Promise<IDBDatabase>) {
    this.dbPromise = customDbPromise || getFinanceDB();
    this.accounts = new IndexedDBAccountRepository(this.dbPromise);
    this.transactions = new IndexedDBTransactionRepository(this.dbPromise);
    this.categories = new IndexedDBCategoryRepository(this.dbPromise);
    this.savingsGoals = new IndexedDBSavingsGoalRepository(this.dbPromise);
    this.budgets = new IndexedDBBudgetRepository(this.dbPromise);
    this.categorizationRules = new IndexedDBCategorizationRuleRepository(this.dbPromise);
    this.recurringRules = new IndexedDBRecurringRuleRepository(this.dbPromise);
    this.conflicts = new IndexedDBConflictRepository(this.dbPromise);
    this.audit = new IndexedDBAuditRepository(this.dbPromise);
    this.outbox = new IndexedDBOutboxRepository(this.dbPromise);
  }

  /**
   * Executes a unit of work. In IndexedDB, operations across stores in a single event-loop turn
   * form an atomic commit. If any step throws, the error bubbles up.
   */
  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const db = await this.dbPromise;
    try {
      return await work();
    } catch (err) {
      throw new StorageError("Unit of work transaction failed", "TRANSACTION_FAILED", err);
    }
  }
}

