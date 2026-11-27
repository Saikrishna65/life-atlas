import { reconcileRepayment, REPAYMENT_CATEGORY, REPAYMENT_CATEGORY_ID } from "../../shared/repayment";
import { reconcileTransactionSplit } from "../../shared/transactionSplit";
import type { SharedGroup } from "../../shared/domain";
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
  const sharedIds = new Set(
    change.transactions.flatMap((row) =>
      [
        row.before?.sharedSplit?.groupId,
        row.after?.sharedSplit?.groupId,
        row.before?.sharedRepayment?.groupId, row.after?.sharedRepayment?.groupId,
      ].filter((id): id is string => !!id),
    ),
  );
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      [
        "transactions",
        "accounts",
        "savings_goals",
        "audit_log",
        "sync_outbox",
        ...(sharedIds.size ? ["shared_groups", "categories"] : []),
      ],
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
    const sharedGroups = new Map<string, SharedGroup>();
    const transferCategories = new Set<string>();
    let hasRepaymentCategory = false;
    if (sharedIds.size) {
      read(tx.objectStore("categories").getAll(), (rows) => {
        for (const row of rows) { if (row.id === REPAYMENT_CATEGORY_ID) hasRepaymentCategory = true; if (row.type === "transfer") transferCategories.add(row.id); }
      });
      for (const id of sharedIds)
        read(tx.objectStore("shared_groups").get(id), (group) => {
          if (group) sharedGroups.set(id, group);
          else if (
            change.transactions.some(
              (row) =>
                (row.after?.sharedSplit?.groupId === id || row.after?.sharedRepayment?.groupId === id) && row.after?.status === "posted",
            )
          )
            throw new Error(
              "This shared group is no longer available. Choose another group or Just me.",
            );
        });
    }
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
        const linkedAt = new Date().toISOString();
        for (const group of sharedGroups.values()) {
          const previous = structuredClone(group);
          let changed = false;
          for (const row of change.transactions)
            if (
              row.before?.sharedSplit?.groupId === group.id ||
              row.after?.sharedSplit?.groupId === group.id
            )
              changed =
                reconcileTransactionSplit(
                  group,
                  row.before,
                  row.after,
                  transferCategories,
                  linkedAt,
                ) || changed;
          for (const row of change.transactions) if (row.before?.sharedRepayment?.groupId === group.id || row.after?.sharedRepayment?.groupId === group.id) changed = reconcileRepayment(group,row.before,row.after,transferCategories,linkedAt) || changed;
          if (changed) {
            const affected = new Set(change.transactions.map(t => (t.after || t.before)!.id));
            const settlementIds = new Set([...previous.settlements,...group.settlements].filter(s => s.sourceTransactionId && affected.has(s.sourceTransactionId)).map(s => s.id));
            tx.objectStore("shared_groups").put(group);
            tx.objectStore("audit_log").add({
              id: crypto.randomUUID(),
              entityType: "shared_group",
              entityId: group.id,
              action: "update",
              performedAt: linkedAt,
              changes: {
                version: { oldVal: previous.version, newVal: group.version },
                linkedSettlements: {oldVal:previous.settlements.filter(s => settlementIds.has(s.id)),newVal:group.settlements.filter(s => settlementIds.has(s.id))},
                linkedExpenses: {
                  oldVal: previous.expenses.filter((e) =>
                    change.transactions.some(
                      (t) =>
                        (t.after || t.before)?.id === e.sourceTransactionId,
                    ),
                  ),
                  newVal: group.expenses.filter((e) =>
                    change.transactions.some(
                      (t) =>
                        (t.after || t.before)?.id === e.sourceTransactionId,
                    ),
                  ),
                },
              },
            });
          }
        }
        if (!hasRepaymentCategory && change.transactions.some(t => t.after?.sharedRepayment && t.after.status === "posted")) tx.objectStore("categories").put(REPAYMENT_CATEGORY);
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
    tx.oncomplete = () => {
      try {
        if (sharedIds.size && typeof window !== "undefined") {
          window.dispatchEvent(new Event("finance-shared-updated"));
          if (typeof BroadcastChannel !== "undefined") {
            const channel = new BroadcastChannel("atlas-shared-expenses");
            try {
              channel.postMessage("ledger");
            } finally {
              channel.close();
            }
          }
        }
      } catch {
        /* The ledger is already committed; notifications are optional. */
      }
      resolve();
    };
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
