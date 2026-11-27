import type { Transaction } from "../domain/models";
import { allocate, ensure, validateGroup, type SharedGroup } from "./domain";
import { localFinanceDateKey } from "../calendar";

export interface TransactionSplit {
  groupId: string;
  memberIds: string[];
}
export function validateTransactionSplit(
  value: unknown,
): asserts value is TransactionSplit {
  ensure(!!value && typeof value === "object", "Choose a valid shared group.");
  const split = value as TransactionSplit;
  ensure(
    typeof split.groupId === "string" &&
      split.groupId.length > 0 &&
      split.groupId.length <= 100,
    "Choose a valid shared group.",
  );
  ensure(
    Array.isArray(split.memberIds) &&
      split.memberIds.length > 0 &&
      split.memberIds.length <= 30 &&
      new Set(split.memberIds).size === split.memberIds.length &&
      split.memberIds.every(
        (id) => typeof id === "string" && id.length > 0 && id.length <= 100,
      ),
    "Choose each split participant once.",
  );
}
/** Called inside the ledger's single read/write transaction, never as a separate cloud operation. */
export function reconcileTransactionSplit(
  group: SharedGroup,
  before: Transaction | null,
  after: Transaction | null,
  transferCategoryIds: Set<string>,
  now: string,
): boolean {
  const source = after || before!;
  const existing = group.expenses.find(
    (e) => e.sourceTransactionId === source.id,
  );
  const split = after?.sharedSplit;
  if (after && split?.groupId === group.id && after.status !== "reversed")
    ensure(
      after.status === "posted" &&
        after.direction === "outflow" &&
        after.paymentKind !== "transfer" &&
        !after.transferGroupId &&
        !transferCategoryIds.has(after.categoryId || ""),
      "Only posted purchases can be split; choose Just me for income, refunds, pending payments or transfers.",
    );
  const active = !!(
    after &&
    split?.groupId === group.id &&
    after.status === "posted" &&
    after.direction === "outflow" &&
    after.paymentKind !== "transfer" &&
    !after.transferGroupId &&
    !transferCategoryIds.has(after.categoryId || "")
  );
  if (!active) {
    if (existing && !existing.voidedAt) {
      existing.voidedAt = now;
      group.version++;
      group.updatedAt = now;
      validateGroup(group);
      return true;
    }
    return false;
  }
  validateTransactionSplit(split);
  ensure(
    after!.currency === group.currency,
    "Choose a shared group with the same currency as this payment.",
  );
  const members = new Set(group.members.map((m) => m.id));
  ensure(
    split!.memberIds.every((id) => members.has(id)),
    "The group’s people changed. Choose the split again before saving.",
  );
  const expense = {
    id: existing?.id || crypto.randomUUID(),
    sourceTransactionId: source.id,
    title: (after!.merchant || after!.description).slice(0, 160),
    amountPaise: after!.amountPaise,
    payerId: group.selfId,
    shares: allocate(after!.amountPaise, split!.memberIds, "equal"),
    splitMode: "equal" as const,
    weights: [],
    date: localFinanceDateKey(after!.occurredAt),
    createdAt: existing?.createdAt || now,
  };
  if (existing && JSON.stringify(existing) === JSON.stringify(expense))
    return false;
  if (existing) group.expenses[group.expenses.indexOf(existing)] = expense;
  else group.expenses.push(expense);
  group.version++;
  group.updatedAt = now;
  validateGroup(group);
  return true;
}

/** Encrypted restores must keep each active bank split paired with exactly one matching expense. */
export function validateSharedLedgerLinks(
  transactions: Transaction[],
  groups: SharedGroup[],
): void {
  const byTransaction = new Map(transactions.map((t) => [t.id, t])),
    byGroup = new Map(groups.map((g) => [g.id, g]));
  for (const group of groups)
    for (const expense of group.expenses)
      if (expense.sourceTransactionId && !expense.voidedAt) {
        const transaction = byTransaction.get(expense.sourceTransactionId);
        ensure(
          transaction &&
            transaction.sharedSplit?.groupId === group.id &&
            transaction.status === "posted" &&
            transaction.direction === "outflow",
          "An active shared expense is missing its original payment.",
        );
        ensure(
          expense.amountPaise === transaction.amountPaise &&
            expense.payerId === group.selfId &&
            expense.splitMode === "equal" &&
            group.currency === transaction.currency,
          "A linked shared expense does not match its original payment.",
        );
        const shares = allocate(
          transaction.amountPaise,
          transaction.sharedSplit!.memberIds,
          "equal",
        );
        ensure(
          JSON.stringify(shares) === JSON.stringify(expense.shares),
          "A linked payment has inconsistent split shares.",
        );
      }
  for (const group of groups) for (const settlement of group.settlements) if (settlement.sourceTransactionId && !settlement.voidedAt) {
    const t = byTransaction.get(settlement.sourceTransactionId);
    ensure(t && t.sharedRepayment?.groupId === group.id && t.sharedRepayment.memberId === settlement.fromId && t.direction === "inflow" && t.status === "posted" && t.paymentKind === "reimbursement" && t.amountPaise === settlement.amountPaise && t.currency === group.currency && settlement.toId === group.selfId && (!t.sharedRepayment.settlementId || t.sharedRepayment.settlementId === settlement.id), "A linked repayment does not match its received bank payment.");
  }
  for (const t of transactions) if (t.sharedRepayment && t.status === "posted") ensure(byGroup.get(t.sharedRepayment.groupId)?.settlements.some(s => s.sourceTransactionId === t.id && !s.voidedAt), "A received repayment is missing its group settlement.");
  for (const transaction of transactions)
    if (transaction.sharedSplit && transaction.status === "posted") {
      const group = byGroup.get(transaction.sharedSplit.groupId);
      ensure(
        group?.expenses.some(
          (e) => e.sourceTransactionId === transaction.id && !e.voidedAt,
        ),
        "A shared payment is missing its group expense.",
      );
    }
}
