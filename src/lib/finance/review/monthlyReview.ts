import type {
  FinanceCategory,
  RecurringRule,
  Transaction,
} from "../domain/models";
import { realizedCashMovement } from "../domain/ledger";
import { addPaise, subtractPaise, assertSafePaise } from "../domain/money";
import { localFinanceDateKey } from "../calendar";

export interface ReviewInput {
  transactions: Transaction[];
  categories: FinanceCategory[];
  rules: RecurringRule[];
  month: string;
  currency: string;
  now?: Date;
}
export interface ReviewTotals {
  spendingPaise: number;
  incomePaise: number;
  refundsPaise: number;
  purchasesPaise: number;
  count: number;
}
export interface ReviewChange {
  currentPaise: number;
  previousPaise: number;
  deltaPaise: number;
  percent: number | null;
}
export interface ReviewFlag {
  transaction: Transaction;
  reason: string;
  medianPaise?: number;
  sampleCount?: number;
}
export interface MonthlyReview {
  month: string;
  currency: string;
  currentMonth: boolean;
  comparisonLabel: string;
  netPaise: number;
  totals: ReviewTotals;
  previous: ReviewTotals;
  comparison: ReviewChange | null;
  categories: {
    id: string;
    name: string;
    currentPaise: number;
    previousPaise: number;
    deltaPaise: number;
  }[];
  regularPaidPaise: number;
  regularPayments: {
    id: string;
    name: string;
    amountPaise: number;
    count: number;
  }[];
  commitments: { rule: RecurringRule; monthlyPaise: number }[];
  monthlyCommitmentPaise: number;
  candidateRules: number;
  flags: ReviewFlag[];
  pendingCount: number;
  excludedTransferCount: number;
  historyCount: number;
  firstRecordedDay: string | null;
}
const blank = (): ReviewTotals => ({
  spendingPaise: 0,
  incomePaise: 0,
  refundsPaise: 0,
  purchasesPaise: 0,
  count: 0,
});
const transfers = (t: Transaction, categories: Set<string>) =>
  t.paymentKind === "transfer" ||
  !!t.transferGroupId ||
  !!(t.categoryId && categories.has(t.categoryId));
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Number((BigInt(sorted[middle - 1]) + BigInt(sorted[middle])) / BigInt(2));
};
const merchantKey = (t: Transaction) =>
  (t.merchant || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function monthlyEquivalent(rule: RecurringRule): number {
  assertSafePaise(rule.amountPaise);
  if (
    !Number.isSafeInteger(rule.interval) ||
    rule.interval < 1 ||
    rule.amountPaise < 0
  )
    throw new Error("Invalid recurring amount or interval.");
  const ratios: Record<RecurringRule["frequency"], [number, number]> = {
    daily: [365, 12],
    weekly: [52, 12],
    biweekly: [26, 12],
    monthly: [1, 1],
    quarterly: [1, 3],
    yearly: [1, 12],
  };
  const ratio = ratios[rule.frequency];
  if (!ratio) throw new Error("Unsupported recurring frequency.");
  const denominator = BigInt(ratio[1]) * BigInt(rule.interval),
    numerator = BigInt(rule.amountPaise) * BigInt(ratio[0]);
  const result = Number((numerator + denominator / BigInt(2)) / denominator);
  assertSafePaise(result);
  return result;
}
export function buildMonthlyReview(input: ReviewInput): MonthlyReview {
  const now = input.now || new Date(),
    today = localFinanceDateKey(now),
    currentKey = today.slice(0, 7);
  if (
    !Number.isFinite(now.getTime()) ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month) ||
    input.month < "1900-01" ||
    input.month > currentKey
  )
    throw new Error("Choose a valid month up to the current month.");
  const [year, month] = input.month.split("-").map(Number),
    start = new Date(year, month - 1, 1),
    previousStart = new Date(year, month - 2, 1),
    previousKey = localFinanceDateKey(previousStart).slice(0, 7);
  const currentMonth = input.month === currentKey,
    priorDays = new Date(year, month - 1, 0).getDate(),
    comparedDays = Math.min(now.getDate(), priorDays);
  const comparisonLabel = currentMonth
    ? `First ${comparedDays} days of each month${comparedDays === now.getDate() ? " · today is still in progress" : " · review totals also include the remaining days so far"}`
    : "Full calendar months";
  const transferIds = new Set(
    input.categories.filter((c) => c.type === "transfer").map((c) => c.id),
  );
  const validDate = (t: Transaction) =>
    Number.isFinite(Date.parse(t.occurredAt)) &&
    Date.parse(t.occurredAt) <= now.getTime();
  const all = input.transactions.filter(
    (t) => t.currency === input.currency && validDate(t),
  );
  for (const t of all) {
    assertSafePaise(t.amountPaise);
    if (t.amountPaise <= 0) throw new Error("A Finance amount is invalid.");
  }
  const eligible = all.filter(
    (t) => t.status === "posted" && !transfers(t, transferIds),
  );
  const day = (t: Transaction) => localFinanceDateKey(t.occurredAt);
  const rows = eligible.filter((t) => day(t).slice(0, 7) === input.month),
    previousRows = eligible.filter(
      (t) =>
        day(t).slice(0, 7) === previousKey &&
        (!currentMonth || Number(day(t).slice(-2)) <= comparedDays),
    );
  const comparedRows = currentMonth
    ? rows.filter((t) => Number(day(t).slice(-2)) <= comparedDays)
    : rows;
  const totalsFor = (records: Transaction[]) =>
    records.reduce((totals, t) => {
      const move = realizedCashMovement(t, transferIds);
      totals.count++;
      totals.spendingPaise = addPaise(totals.spendingPaise, move.expense);
      totals.incomePaise = addPaise(totals.incomePaise, move.income);
      if (move.expense < 0)
        totals.refundsPaise = addPaise(totals.refundsPaise, -move.expense);
      if (move.expense > 0)
        totals.purchasesPaise = addPaise(totals.purchasesPaise, move.expense);
      return totals;
    }, blank());
  const totals = totalsFor(rows),
    previous = totalsFor(previousRows),
    compared = totalsFor(comparedRows);
  const deltaPaise = subtractPaise(
    compared.spendingPaise,
    previous.spendingPaise,
  );
  const comparison = previousRows.length
    ? {
        currentPaise: compared.spendingPaise,
        previousPaise: previous.spendingPaise,
        deltaPaise,
        percent:
          previous.spendingPaise > 0
            ? (deltaPaise / previous.spendingPaise) * 100
            : null,
      }
    : null;
  const categoryNames = new Map(input.categories.map((c) => [c.id, c.name]));
  const categories = new Map<
    string,
    {
      id: string;
      name: string;
      currentPaise: number;
      previousPaise: number;
      deltaPaise: number;
    }
  >();
  for (const [records, field] of [
    [comparedRows, "currentPaise"],
    [previousRows, "previousPaise"],
  ] as const)
    for (const t of records) {
      const move = realizedCashMovement(t, transferIds);
      if (!move.expense) continue;
      const id = t.categoryId || "uncategorized",
        entry = categories.get(id) || {
          id,
          name: categoryNames.get(id) || "Uncategorized",
          currentPaise: 0,
          previousPaise: 0,
          deltaPaise: 0,
        };
      entry[field] = addPaise(entry[field], move.expense);
      categories.set(id, entry);
    }
  for (const entry of categories.values())
    entry.deltaPaise = subtractPaise(entry.currentPaise, entry.previousPaise);
  const ruleMap = new Map(input.rules.map((r) => [r.id, r])),
    eligibleById = new Map(eligible.map((t) => [t.id, t]));
  const regularPayments = new Map<
    string,
    { id: string; name: string; amountPaise: number; count: number }
  >();
  let regularPaidPaise = 0;
  for (const t of rows) {
    const move = realizedCashMovement(t, transferIds);
    if (!move.expense) continue;
    const original = t.originalTransactionId
      ? eligibleById.get(t.originalTransactionId)
      : undefined;
    const source = move.expense < 0 ? original || t : t;
    if (!source.recurringRuleId && source.paymentKind !== "automatic_bill")
      continue;
    const id =
        source.recurringRuleId ||
        `unlinked:${merchantKey(source) || source.id}`,
      rule = source.recurringRuleId
        ? ruleMap.get(source.recurringRuleId)
        : undefined;
    const entry = regularPayments.get(id) || {
      id,
      name:
        rule?.merchant ||
        rule?.description ||
        source.merchant ||
        source.description,
      amountPaise: 0,
      count: 0,
    };
    entry.amountPaise = addPaise(entry.amountPaise, move.expense);
    entry.count++;
    regularPayments.set(id, entry);
    regularPaidPaise = addPaise(regularPaidPaise, move.expense);
  }
  const commitments = input.rules
    .filter(
      (r) =>
        r.currency === input.currency &&
        r.direction === "outflow" &&
        r.status === "confirmed" &&
        !transferIds.has(r.categoryId || "") &&
        Date.parse(r.startDate) <= now.getTime() &&
        (!r.endDate || localFinanceDateKey(r.endDate) >= today),
    )
    .map((rule) => ({ rule, monthlyPaise: monthlyEquivalent(rule) }))
    .sort(
      (a, b) =>
        b.monthlyPaise - a.monthlyPaise || a.rule.id.localeCompare(b.rule.id),
    );
  const historyStart = new Date(year, month - 1, 1);
  historyStart.setDate(historyStart.getDate() - 90);
  const history = eligible.filter(
    (t) =>
      t.direction === "outflow" &&
      Date.parse(t.occurredAt) >= historyStart.getTime() &&
      Date.parse(t.occurredAt) < start.getTime(),
  );
  const byMerchant = new Map<string, number[]>(),
    byCategory = new Map<string, number[]>();
  for (const t of history) {
    const append = (map: Map<string, number[]>, key: string) => {
      const values = map.get(key) || [];
      values.push(t.amountPaise);
      map.set(key, values);
    };
    const key = merchantKey(t);
    if (key) append(byMerchant, key);
    if (t.categoryId) append(byCategory, t.categoryId);
  }
  const medianMerchant = new Map(
    [...byMerchant]
      .filter(([, v]) => v.length >= 3)
      .map(([key, v]) => [key, { median: median(v), count: v.length }]),
  );
  const medianCategory = new Map(
    [...byCategory]
      .filter(([, v]) => v.length >= 5)
      .map(([key, v]) => [key, { median: median(v), count: v.length }]),
  );
  const minimumDifference = input.currency === "INR" ? 50000 : 2000;
  const flags: ReviewFlag[] = [];
  for (const t of rows) {
    const reasons: string[] = [];
    let typical: { median: number; count: number } | undefined;
    if (t.reviewRequired) reasons.push("Already marked for review in Finance");
    if (t.direction === "outflow") {
      const merchant = medianMerchant.get(merchantKey(t)),
        category = t.categoryId ? medianCategory.get(t.categoryId) : undefined;
      typical = merchant || category;
      if (
        typical &&
        BigInt(t.amountPaise) >= BigInt(typical.median) * BigInt(3) &&
        subtractPaise(t.amountPaise, typical.median) >= minimumDifference
      )
        reasons.push(
          `At least 3× your earlier ${merchant ? "merchant" : "category"} median (${typical.count} payments in the preceding 90 days)`,
        );
      else typical = undefined;
    }
    if (reasons.length)
      flags.push({
        transaction: t,
        reason: reasons.join(". "),
        ...(typical
          ? { medianPaise: typical.median, sampleCount: typical.count }
          : {}),
      });
  }
  flags.sort(
    (a, b) =>
      b.transaction.amountPaise - a.transaction.amountPaise ||
      a.transaction.id.localeCompare(b.transaction.id),
  );
  const selected = all.filter((t) => day(t).slice(0, 7) === input.month);
  return {
    netPaise: subtractPaise(totals.incomePaise, totals.spendingPaise),
    month: input.month,
    currency: input.currency,
    currentMonth,
    comparisonLabel,
    totals,
    previous,
    comparison,
    categories: [...categories.values()].sort(
      (a, b) =>
        Math.abs(b.deltaPaise) - Math.abs(a.deltaPaise) ||
        a.id.localeCompare(b.id),
    ),
    regularPaidPaise,
    regularPayments: [...regularPayments.values()].sort(
      (a, b) => b.amountPaise - a.amountPaise || a.id.localeCompare(b.id),
    ),
    commitments,
    monthlyCommitmentPaise: commitments.reduce(
      (sum, c) => addPaise(sum, c.monthlyPaise),
      0,
    ),
    candidateRules: input.rules.filter(
      (r) =>
        r.currency === input.currency &&
        r.direction === "outflow" &&
        r.status === "detected",
    ).length,
    flags,
    pendingCount: selected.filter((t) => t.status === "pending").length,
    excludedTransferCount: selected.filter(
      (t) => t.status === "posted" && transfers(t, transferIds),
    ).length,
    historyCount: history.length,
    firstRecordedDay: eligible.length ? eligible.map(day).sort()[0] : null,
  };
}
