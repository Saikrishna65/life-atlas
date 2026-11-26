import type { LedgerChange } from "../interfaces";
import type { FinanceAccount, Transaction } from "../../domain/models";
import {
  computeAccountBalances,
  generateTransactionFingerprint,
} from "../../domain/ledger";
import { FinanceError } from "../../domain/errors";
import {
  validateTransaction,
  validateSavingsGoal,
  validateSyncOperation,
} from "../../domain/validation";

/** All comparisons, journal writes, pocket allocation, balances and receipts share ONE IDB commit. */
export function commitLedgerChange(
  db: IDBDatabase,
  change: LedgerChange,
): Promise<void> {
  for (const row of change.transactions)
    if (row.after) validateTransaction(row.after);
  for (const row of change.pockets) validateSavingsGoal(row.after);
  change.outbox.forEach(validateSyncOperation);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["transactions", "accounts", "savings_goals", "audit_log", "sync_outbox"],
      "readwrite",
    );
    let failure: unknown;
    let waiting = 0;
    const fail = (error: unknown) => {
      failure = error;
      try {
        tx.abort();
      } catch {}
    };
    const accounts = new Map<string, FinanceAccount>(),
      journals = new Map<string, Transaction[]>();
    const ids = new Set(
      change.transactions.flatMap((row) =>
        [row.before?.accountId, row.after?.accountId].filter(
          (id): id is string => !!id,
        ),
      ),
    );
    const read = <V>(request: IDBRequest<V>, accept: (value: V) => void) => {
      waiting++;
      request.onsuccess = () => {
        try {
          accept(request.result);
          if (--waiting === 0) apply();
        } catch (error) {
          fail(error);
        }
      };
    };
    const conflict = () =>
      new FinanceError(
        "This payment or pocket changed while saving. Review it and try again.",
        "CONCURRENCY_CONFLICT",
      );
    for (const item of change.transactions) {
      const row = item.after || item.before!;
      read(tx.objectStore("transactions").get(row.id), (stored) => {
        if (
          item.before
            ? !stored || (stored.version || 1) !== (item.before.version || 1)
            : !!stored
        )
          throw conflict();
      });
    }
    for (const item of change.pockets)
      read(tx.objectStore("savings_goals").get(item.before.id), (stored) => {
        if (!stored || (stored.version || 1) !== (item.before.version || 1))
          throw conflict();
      });
    for (const id of ids) {
      read(tx.objectStore("accounts").get(id), (account) => {
        if (!account)
          throw new FinanceError(
            "Account no longer exists.",
            "INVALID_ACCOUNT",
          );
        accounts.set(id, account);
      });
      read(
        tx.objectStore("transactions").index("accountId").getAll(id),
        (rows) => journals.set(id, rows),
      );
    }
    function apply() {
      try {
        for (const item of change.transactions)
          if (item.after) {
            const account = accounts.get(item.after.accountId)!;
            if (item.after.currency !== account.currency)
              throw new FinanceError(
                "Payment currency must match its account.",
                "CURRENCY_MISMATCH",
              );
            if (!item.before && account.status !== "active")
              throw new FinanceError(
                "This account is archived.",
                "ACCOUNT_ARCHIVED",
              );
            if (!item.before && !item.after.transferGroupId) {
              const fp = generateTransactionFingerprint(item.after);
              if (
                journals
                  .get(account.id)!
                  .some(
                    (t) =>
                      t.id !== item.after!.id &&
                      generateTransactionFingerprint(t) === fp,
                  )
              )
                throw new FinanceError(
                  "This payment is already recorded.",
                  "DUPLICATE_TRANSACTION",
                );
            }
          }
        for (const id of ids) {
          const existing = journals.get(id)!;
          const changed = new Set(
            change.transactions.map((row) => (row.after || row.before)!.id),
          );
          const rows = existing
            .filter((t) => !changed.has(t.id))
            .concat(
              change.transactions.flatMap((row) =>
                row.after?.accountId === id ? [row.after] : [],
              ),
            );
          const account = accounts.get(id)!;
          account.currentBalancePaise = computeAccountBalances(
            account,
            rows,
          ).postedBalancePaise;
          account.updatedAt = new Date().toISOString();
          account.version = (account.version || 1) + 1;
          tx.objectStore("accounts").put(account);
        }
        for (const item of change.transactions) {
          if (item.after) tx.objectStore("transactions").put(item.after);
          else tx.objectStore("transactions").delete(item.before!.id);
        }
        for (const item of change.pockets)
          tx.objectStore("savings_goals").put(item.after);
        for (const event of change.audit)
          tx.objectStore("audit_log").add(event);
        for (const operation of change.outbox)
          tx.objectStore("sync_outbox").add(operation);
      } catch (error) {
        fail(error);
      }
    }
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        failure ||
          tx.error ||
          new FinanceError(
            "Payment could not be saved. No changes were made.",
            "TRANSACTION_FAILED",
          ),
      );
    tx.onerror = () => {
      failure ||= tx.error;
    };
    if (!waiting) apply();
  });
}
