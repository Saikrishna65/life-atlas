import type {
  FinanceCategory,
  PaymentKind,
  Transaction,
} from "../domain/models";
import {
  checkSettlement,
  ensure,
  validateGroup,
  type SharedGroup,
} from "./domain";
import { localFinanceDateKey } from "../calendar";
export const REPAYMENT_CATEGORY_ID = "cat_shared_repayments";
export const REPAYMENT_CATEGORY: FinanceCategory = {
  id: REPAYMENT_CATEGORY_ID,
  name: "Shared repayments",
  icon: "Users",
  color: "#527e8c",
  type: "expense",
  isSystem: true,
  sortOrder: 95,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
export interface RepaymentSelection {
  groupId: string;
  memberId: string;
  settlementId?: string;
  allowOverpayment?: boolean;
}
export interface LinkedRepayment extends RepaymentSelection {
  previousKind?: Exclude<PaymentKind, "reimbursement">;
  previousCategoryId?: string;
}
export function validateRepayment(
  value: unknown,
): asserts value is LinkedRepayment {
  ensure(value && typeof value === "object", "Choose a valid repayment.");
  const r = value as LinkedRepayment;
  for (const id of [r.groupId, r.memberId])
    ensure(
      typeof id === "string" && id.length > 0 && id.length <= 100,
      "Choose a group and the person who repaid you.",
    );
  if (r.settlementId !== undefined)
    ensure(
      typeof r.settlementId === "string" &&
        r.settlementId.length > 0 &&
        r.settlementId.length <= 100,
      "Choose a valid recorded payment.",
    );
  if (r.allowOverpayment !== undefined)
    ensure(
      typeof r.allowOverpayment === "boolean",
      "Confirm any actual overpayment.",
    );
  if (r.previousKind !== undefined)
    ensure(
      ["purchase", "salary", "refund", "transfer", "automatic_bill"].includes(
        r.previousKind,
      ),
      "Invalid original payment type.",
    );
  if (r.previousCategoryId !== undefined)
    ensure(
      typeof r.previousCategoryId === "string" &&
        r.previousCategoryId.length <= 100,
      "Invalid original category.",
    );
}
export function applyRepaymentSelection(
  transaction: Transaction,
  before: Transaction | null,
  selection: RepaymentSelection | null | undefined,
) {
  if (selection === undefined) return;
  if (selection) {
    validateRepayment(selection);
    ensure(
      !transaction.sharedSplit,
      "A payment cannot be both a shared expense and a repayment.",
    );
    transaction.sharedRepayment = {
      groupId: selection.groupId,
      memberId: selection.memberId,
      ...(selection.settlementId
        ? { settlementId: selection.settlementId }
        : {}),
      ...(selection.allowOverpayment ? { allowOverpayment: true } : {}),
      previousKind:
        before?.sharedRepayment?.previousKind ??
        (transaction.paymentKind === "reimbursement"
          ? undefined
          : transaction.paymentKind),
      previousCategoryId: before?.sharedRepayment
        ? before.sharedRepayment.previousCategoryId
        : transaction.categoryId,
    };
    transaction.paymentKind = "reimbursement";
    transaction.categoryId = REPAYMENT_CATEGORY_ID;
  } else {
    const previous = before?.sharedRepayment;
    if (transaction.paymentKind === "reimbursement")
      transaction.paymentKind =
        transaction.direction === "inflow"
          ? previous?.previousKind || "salary"
          : "purchase";
    if (transaction.categoryId === REPAYMENT_CATEGORY_ID)
      transaction.categoryId = previous?.previousCategoryId;
    delete transaction.sharedRepayment;
  }
}
/** The bank credit and this settlement are committed by the same native IndexedDB transaction. */
export function reconcileRepayment(
  group: SharedGroup,
  before: Transaction | null,
  after: Transaction | null,
  transfers: Set<string>,
  now: string,
): boolean {
  const source = after || before!,
    match = after?.sharedRepayment;
  const linked = group.settlements.find(
    (s) => s.sourceTransactionId === source.id,
  );
  if (after && match?.groupId === group.id && after.status !== "reversed")
    ensure(after.status === "posted", "Match only a posted incoming payment.");
  const active = !!(
    after &&
    match?.groupId === group.id &&
    after.status === "posted"
  );
  if (!active) {
    if (!linked || linked.voidedAt) return false;
    if (
      after &&
      before?.sharedRepayment?.settlementId === linked.id &&
      (!match || match.groupId !== group.id) &&
      linked.originalManual
    ) {
      linked.date = linked.originalManual.date;
      linked.note = linked.originalManual.note;
      delete linked.originalManual;
      delete linked.sourceTransactionId;
    } else linked.voidedAt = now;
    group.version++;
    group.updatedAt = now;
    validateGroup(group);
    return true;
  }
  validateRepayment(match);
  ensure(
    after!.direction === "inflow" &&
      after!.paymentKind === "reimbursement" &&
      !after!.transferGroupId &&
      !after!.sharedSplit &&
      !transfers.has(after!.categoryId || ""),
    "Only a posted incoming payment can settle a roommate balance.",
  );
  ensure(
    after!.currency === group.currency,
    "Choose a repayment group with the same currency as the received money.",
  );
  ensure(
    group.members.some((m) => m.id === match!.memberId) &&
      match!.memberId !== group.selfId,
    "Choose the person who repaid you.",
  );
  const existing =
    linked ||
    (match!.settlementId
      ? group.settlements.find((s) => s.id === match!.settlementId)
      : undefined);
  if (match!.settlementId)
    ensure(
      existing &&
        (linked || !existing.voidedAt) &&
        (!existing.sourceTransactionId ||
          existing.sourceTransactionId === source.id) &&
        existing.fromId === match!.memberId &&
        existing.toId === group.selfId &&
        (linked || existing.amountPaise === after!.amountPaise),
      "That recorded payment changed or is already linked. Select the repayment again.",
    );
  const payment = {
    fromId: match!.memberId,
    toId: group.selfId,
    amountPaise: after!.amountPaise,
  };
  if (
    (!match!.settlementId || linked) &&
    !(
      linked &&
      !linked.voidedAt &&
      linked.fromId === match!.memberId &&
      after!.amountPaise <= linked.amountPaise
    )
  )
    checkSettlement(
      {
        ...group,
        settlements: group.settlements.filter((s) => s.id !== existing?.id),
      },
      payment,
      true,
      !!match!.allowOverpayment,
    );
  const next = {
    id: existing?.id || crypto.randomUUID(),
    ...payment,
    date: localFinanceDateKey(after!.occurredAt),
    note:
      existing?.note || `Bank repayment · ${after!.description}`.slice(0, 500),
    createdAt: existing?.createdAt || now,
    sourceTransactionId: source.id,
    ...(existing?.originalManual
      ? { originalManual: existing.originalManual }
      : existing && !existing.sourceTransactionId
        ? { originalManual: { date: existing.date, note: existing.note } }
        : {}),
  };
  if (existing && JSON.stringify(existing) === JSON.stringify(next))
    return false;
  if (existing) group.settlements[group.settlements.indexOf(existing)] = next;
  else group.settlements.push(next);
  group.version++;
  group.updatedAt = now;
  validateGroup(group);
  return true;
}
