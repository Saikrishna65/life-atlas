import type { IUnitOfWork, LedgerChange } from "../storage/interfaces";
import type { Transaction, SavingsGoal } from "../domain/models";
import { validateTransaction } from "../domain/validation";
import { isControlRestoreActive } from "../../control-room/maintenance";
import { FinanceError } from "../domain/errors";

/** Stage a service's writes without holding an IDB transaction open during async trip/auth work. */
export async function stageLedgerMutation<T>(
  uow: IUnitOfWork,
  work: (staged: IUnitOfWork) => Promise<T>,
): Promise<T> {
  if (isControlRestoreActive())
    throw new FinanceError(
      "A restore is in progress. Try again when it finishes.",
      "CONCURRENCY_CONFLICT",
    );
  const change: LedgerChange = {
    transactions: [],
    pockets: [],
    audit: [],
    outbox: [],
  };
  const originalTransactions = new Map<string, Transaction | null>(),
    originalPockets = new Map<string, SavingsGoal | null>();
  const clone = <V>(value: V): V => structuredClone(value);
  const proxy = <V extends object>(target: V, overrides: Partial<V>): V =>
    new Proxy(target, {
      get(object, key) {
        if (key in overrides) return overrides[key as keyof V];
        const value = Reflect.get(object, key);
        return typeof value === "function" ? value.bind(object) : value;
      },
    });
  const readTransaction = async (id: string) => {
    const staged = change.transactions.find(
      (t) => (t.after || t.before)?.id === id,
    );
    if (staged) return clone(staged.after);
    const value = await uow.transactions.getById(id);
    if (!originalTransactions.has(id))
      originalTransactions.set(id, clone(value));
    return value;
  };
  const saveTransaction = async (value: Transaction) => {
    const after = validateTransaction(clone(value));
    if (!originalTransactions.has(after.id)) await readTransaction(after.id);
    const previous = change.transactions.find(
      (t) => (t.after || t.before)?.id === after.id,
    );
    if (previous) previous.after = after;
    else
      change.transactions.push({
        before: originalTransactions.get(after.id) || null,
        after,
      });
  };
  const readPocket = async (id: string) => {
    const staged = change.pockets.find((p) => p.after.id === id);
    if (staged) return clone(staged.after);
    const value = await uow.savingsGoals.getById(id);
    if (!originalPockets.has(id)) originalPockets.set(id, clone(value));
    return value;
  };
  const staged = proxy(uow, {
    transactions: proxy(uow.transactions, {
      getById: readTransaction,
      getByTransferGroupId: async (id: string) => {
        const rows = await uow.transactions.getByTransferGroupId(id);
        for (const row of rows)
          if (!originalTransactions.has(row.id))
            originalTransactions.set(row.id, clone(row));
        return rows;
      },
      save: saveTransaction,
      saveBatch: async (rows: Transaction[]) => {
        for (const row of rows) await saveTransaction(row);
      },
      delete: async (id: string) => {
        if (!originalTransactions.has(id)) await readTransaction(id);
        const before = originalTransactions.get(id);
        if (!before) return;
        const existing = change.transactions.find(
          (t) => (t.after || t.before)?.id === id,
        );
        if (existing) existing.after = null;
        else change.transactions.push({ before, after: null });
      },
    }),
    savingsGoals: proxy(uow.savingsGoals, {
      getById: readPocket,
      save: async (after: SavingsGoal) => {
        if (!originalPockets.has(after.id)) await readPocket(after.id);
        const before = originalPockets.get(after.id);
        if (!before)
          throw new FinanceError(
            "Pocket no longer exists.",
            "CONCURRENCY_CONFLICT",
          );
        const old = change.pockets.find((p) => p.after.id === after.id);
        if (old) old.after = clone(after);
        else change.pockets.push({ before, after: clone(after) });
      },
    }),
    audit: proxy(uow.audit, {
      record: async (event) => {
        change.audit.push(clone(event));
      },
    }),
    outbox: proxy(uow.outbox, {
      enqueue: async (event) => {
        change.outbox.push(clone(event));
      },
    }),
  });
  const result = await work(staged);
  if (!change.transactions.length && !change.pockets.length) return result;
  // Every ledger change, including corrections/reversals/deletion and both transfer legs, is syncable.
  const now = new Date().toISOString();
  for (const item of change.transactions) {
    const row = item.after || item.before!;
    if (
      !change.outbox.some(
        (o) => o.entityType === "transaction" && o.entityId === row.id,
      )
    )
      change.outbox.push({
        id: crypto.randomUUID(),
        entityType: "transaction",
        entityId: row.id,
        action: !item.after ? "delete" : item.before ? "update" : "create",
        payloadJson: JSON.stringify(item.after || item.before),
        timestamp: now,
        status: "pending",
        retryCount: 0,
        idempotencyKey: `ledger:${row.id}:${item.after?.version || row.version}:${item.after ? "save" : "delete"}`,
      });
    if (
      !change.audit.some(
        (a) => a.entityType === "transaction" && a.entityId === row.id,
      )
    )
      change.audit.push({
        id: crypto.randomUUID(),
        entityType: "transaction",
        entityId: row.id,
        action: item.after ? "reverse" : "delete",
        changes: { record: { oldVal: item.before, newVal: item.after } },
        performedAt: now,
      });
  }
  if (isControlRestoreActive())
    throw new FinanceError(
      "A restore is in progress. Try again when it finishes.",
      "CONCURRENCY_CONFLICT",
    );
  await uow.commitLedgerChange(change);
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("finance-ledger-updated"));
  return result;
}
