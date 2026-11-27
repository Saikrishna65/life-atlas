import { commitLedgerChange } from "./ledgerCommit";
/**
 * Atlas Finance: IndexedDB Unit of Work
 *
 * Provides coordinated repository access and atomic transaction boundary execution.
 */

import {
  IUnitOfWork,
  LedgerChange,
  FinanceDashboardRecords,
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
    this.categorizationRules = new IndexedDBCategorizationRuleRepository(
      this.dbPromise,
    );
    this.recurringRules = new IndexedDBRecurringRuleRepository(this.dbPromise);
    this.conflicts = new IndexedDBConflictRepository(this.dbPromise);
    this.audit = new IndexedDBAuditRepository(this.dbPromise);
    this.outbox = new IndexedDBOutboxRepository(this.dbPromise);
  }

  async readDashboardRecords(): Promise<FinanceDashboardRecords> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const stores = {
        accounts: "accounts",
        transactions: "transactions",
        categories: "categories",
        pockets: "savings_goals",
        rules: "recurring_rules",
      } as const;
      const tx = db.transaction(
        [...Object.values(stores), "sync_outbox"],
        "readonly",
      );
      const result = { pendingOutboxCount: 0 } as FinanceDashboardRecords;
      for (const status of [
        "pending",
        "failed_retryable",
        "failed_permanent",
        "failed",
        "in_progress",
      ]) {
        const count = tx
          .objectStore("sync_outbox")
          .index("status")
          .count(status);
        count.onsuccess = () => {
          result.pendingOutboxCount += count.result;
        };
      }
      for (const [field, name] of Object.entries(stores)) {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => {
          Object.assign(result, { [field]: request.result });
        };
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () =>
        reject(
          new StorageError(
            "Could not read finances.",
            "PERSISTENCE_FAILED",
            tx.error,
          ),
        );
      tx.onabort = () =>
        reject(
          new StorageError(
            "Finance read interrupted.",
            "PERSISTENCE_FAILED",
            tx.error,
          ),
        );
    });
  }

  commitLedgerChange(change: LedgerChange): Promise<void> {
    return this.dbPromise.then((db) => commitLedgerChange(db, change));
  }

  /** Legacy callback coordination only. Ledger writes use commitLedgerChange for actual atomicity. */
  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    await this.dbPromise;
    try {
      return await work();
    } catch (err) {
      throw new StorageError(
        "Unit of work transaction failed",
        "TRANSACTION_FAILED",
        err,
      );
    }
  }
}
