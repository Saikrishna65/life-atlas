import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMonthlyReview,
  monthlyEquivalent,
  type ReviewInput,
} from "@/lib/finance/review/monthlyReview";
import type {
  FinanceCategory,
  RecurringRule,
  Transaction,
} from "@/lib/finance/domain/models";
const now = new Date(2026, 10, 26, 12),
  iso = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d, 10).toISOString();
const txn = (
  id: string,
  amountPaise: number,
  date = iso(2026, 11, 10),
  extra: Partial<Transaction> = {},
): Transaction => ({
  id,
  amountPaise,
  accountId: "a",
  currency: "INR",
  direction: "outflow",
  status: "posted",
  source: "manual",
  description: id,
  categoryId: "food",
  reviewRequired: false,
  occurredAt: date,
  createdAt: date,
  updatedAt: date,
  version: 1,
  ...extra,
});
const rule = (extra: Partial<RecurringRule> = {}): RecurringRule => ({
  id: "subscription",
  accountId: "a",
  currency: "INR",
  direction: "outflow",
  amountPaise: 120000,
  frequency: "yearly",
  interval: 1,
  startDate: iso(2026, 1, 1),
  nextDueDate: iso(2027, 1, 1),
  description: "Annual subscription",
  autoPost: false,
  status: "confirmed",
  createdAt: iso(2026, 1, 1),
  updatedAt: iso(2026, 1, 1),
  ...extra,
});
const categories = [
  { id: "food", name: "Food", type: "expense" },
  { id: "moving", name: "Transfers", type: "transfer" },
] as FinanceCategory[];
const review = (
  transactions: Transaction[],
  extra: Partial<ReviewInput> = {},
) =>
  buildMonthlyReview({
    transactions,
    categories,
    rules: [],
    month: "2026-11",
    currency: "INR",
    now,
    ...extra,
  });
test("posted purchases and refunds reconcile without treating transfers, pending or reversals as spending", () => {
  const result = review([
    txn("purchase", 100000),
    txn("refund", 20000, undefined, {
      direction: "inflow",
      paymentKind: "refund",
    }),
    txn("salary", 300000, undefined, { direction: "inflow" }),
    txn("pending", 5000, undefined, { status: "pending" }),
    txn("reversed", 5000, undefined, { status: "reversed" }),
    txn("transfer1", 5000, undefined, { transferGroupId: "own" }),
    txn("transfer2", 5000, undefined, { categoryId: "moving" }),
    txn("transfer3", 5000, undefined, { paymentKind: "transfer" }),
  ]);
  assert.equal(result.totals.spendingPaise, 80000);
  assert.equal(result.totals.incomePaise, 300000);
  assert.equal(result.totals.refundsPaise, 20000);
  assert.equal(result.totals.purchasesPaise, 100000);
  assert.equal(result.pendingCount, 1);
  assert.equal(result.excludedTransferCount, 3);
  assert.equal(result.totals.count, 3);
});
test("month-to-date compares the same days and excludes later prior-month spending", () => {
  const result = review([
    txn("now", 15000),
    txn("prior", 10000, iso(2026, 10, 10)),
    txn("late", 90000, iso(2026, 10, 30)),
  ]);
  assert.equal(result.comparison?.deltaPaise, 5000);
  assert.equal(result.comparison?.percent, 50);
  assert.equal(result.previous.spendingPaise, 10000);
  assert.match(result.comparisonLabel, /First 26 days/);
});
test("short prior months use comparable dates while preserving the full review total", () => {
  const result = review(
    [
      txn("march", 10000, iso(2026, 3, 20)),
      txn("march-end", 5000, iso(2026, 3, 30)),
      txn("feb", 10000, iso(2026, 2, 20)),
    ],
    { month: "2026-03", now: new Date(2026, 2, 31, 12) },
  );
  assert.equal(result.totals.spendingPaise, 15000);
  assert.equal(result.comparison?.currentPaise, 10000);
  assert.equal(result.comparison?.deltaPaise, 0);
  assert.match(result.comparisonLabel, /First 28 days/);
});
test("completed months compare full calendar months and year rollover works", () => {
  const result = review(
    [
      txn("oct-end", 20000, iso(2026, 10, 31)),
      txn("sept-end", 10000, iso(2026, 9, 30)),
    ],
    { month: "2026-10" },
  );
  assert.equal(result.comparison?.deltaPaise, 10000);
  assert.equal(result.comparisonLabel, "Full calendar months");
  assert.equal(
    review(
      [txn("jan", 2000, iso(2026, 1, 5)), txn("dec", 1000, iso(2025, 12, 5))],
      { month: "2026-01" },
    ).comparison?.percent,
    100,
  );
});
test("missing history and zero or negative baselines never produce misleading percentages", () => {
  assert.equal(review([txn("now", 1000)]).comparison, null);
  assert.equal(
    review([
      txn("income", 1000, iso(2026, 10, 10), { direction: "inflow" }),
      txn("now", 1000),
    ]).comparison?.percent,
    null,
  );
  const r = review([
    txn("refund", 1000, iso(2026, 10, 10), {
      direction: "inflow",
      paymentKind: "refund",
    }),
    txn("now", 1000),
  ]);
  assert.equal(r.comparison?.percent, null);
  assert.equal(r.comparison?.deltaPaise, 2000);
});
test("currencies, future timestamps and archived/reversed entries do not leak into other totals", () => {
  const r = review([
    txn("inr", 1000),
    txn("usd", 10000, undefined, { currency: "USD" }),
    txn("future", 90000, iso(2026, 11, 27)),
    txn("invalid", 9000, "not-a-date"),
  ]);
  assert.equal(r.totals.spendingPaise, 1000);
  assert.equal(r.totals.count, 1);
  assert.equal(r.firstRecordedDay, "2026-11-10");
});
test("category changes retain missing categories, prior-only categories and refunds", () => {
  const r = review([
    txn("current", 10000),
    txn("prior", 5000, iso(2026, 10, 5)),
    txn("unknown", 4000, undefined, { categoryId: "deleted" }),
    txn("old", 3000, iso(2026, 10, 2), { categoryId: "old" }),
    txn("refund", 2000, undefined, {
      direction: "inflow",
      paymentKind: "refund",
    }),
  ]);
  assert.equal(r.categories.find((c) => c.id === "food")?.deltaPaise, 3000);
  assert.equal(
    r.categories.find((c) => c.id === "deleted")?.name,
    "Uncategorized",
  );
  assert.equal(r.categories.find((c) => c.id === "old")?.deltaPaise, -3000);
});
test("regular actual costs require explicit provenance and track linked refunds without merchant guessing", () => {
  const r = review(
    [
      txn("original", 10000, undefined, { recurringRuleId: "subscription" }),
      txn("refund", 2000, undefined, {
        direction: "inflow",
        paymentKind: "refund",
        originalTransactionId: "original",
      }),
      txn("same-merchant", 30000, undefined, {
        merchant: "Annual subscription",
      }),
      txn("automatic", 4000, undefined, { paymentKind: "automatic_bill" }),
    ],
    { rules: [rule()] },
  );
  assert.equal(r.regularPaidPaise, 12000);
  assert.equal(r.regularPayments.length, 2);
  assert.equal(
    r.regularPayments.find((p) => p.id === "subscription")?.amountPaise,
    8000,
  );
});
test("monthly equivalents account for intervals, weekly approximation and annual rounding", () => {
  assert.equal(monthlyEquivalent(rule()), 10000);
  assert.equal(
    monthlyEquivalent(
      rule({ frequency: "monthly", interval: 2, amountPaise: 50001 }),
    ),
    25001,
  );
  assert.equal(
    monthlyEquivalent(rule({ frequency: "weekly", amountPaise: 1200 })),
    5200,
  );
  assert.equal(
    monthlyEquivalent(rule({ frequency: "quarterly", amountPaise: 9000 })),
    3000,
  );
  assert.equal(
    monthlyEquivalent(rule({ frequency: "daily", amountPaise: 1200 })),
    36500,
  );
  assert.equal(
    monthlyEquivalent(rule({ frequency: "biweekly", amountPaise: 1200 })),
    2600,
  );
  assert.throws(() => monthlyEquivalent(rule({ interval: 0 })));
  assert.throws(() =>
    monthlyEquivalent(
      rule({ amountPaise: Number.MAX_SAFE_INTEGER, frequency: "daily" }),
    ),
  );
});
test("commitment estimate excludes paused, unconfirmed, ended, income and other-currency rules", () => {
  const r = review([], {
    rules: [
      rule(),
      rule({ id: "paused", status: "paused" }),
      rule({ id: "detected", status: "detected" }),
      rule({ id: "ended", endDate: iso(2026, 5, 1) }),
      rule({ id: "income", direction: "inflow" }),
      rule({ id: "usd", currency: "USD" }),
    ],
  });
  assert.equal(r.monthlyCommitmentPaise, 10000);
  assert.equal(r.commitments.length, 1);
  assert.equal(r.candidateRules, 1);
});
test("unusual merchant amounts use only preceding history and explain the median and sample count", () => {
  const past = [1, 2, 3].map((i) =>
    txn(`prior${i}`, 20000, iso(2026, 10, i), { merchant: "Cafe River" }),
  );
  const r = review([
    ...past,
    txn("large", 100000, undefined, { merchant: "CAFE  RIVER" }),
    txn("same-month", 200000, undefined, { merchant: "Cafe River" }),
  ]);
  assert.equal(r.flags.length, 2);
  assert.equal(r.flags[0].medianPaise, 20000);
  assert.equal(r.flags[0].sampleCount, 3);
  assert.match(r.flags[0].reason, /merchant median/);
});
test("sparse, stale and small-difference histories do not create amount alerts; manual review survives", () => {
  const r = review([
    txn("a", 100, iso(2026, 10, 1), { merchant: "Cafe" }),
    txn("b", 100, iso(2026, 10, 2), { merchant: "Cafe" }),
    txn("old", 100, iso(2026, 1, 1), { merchant: "Cafe" }),
    txn("new", 1000000, undefined, { merchant: "Cafe" }),
    txn("manual", 1000, undefined, { reviewRequired: true }),
  ]);
  assert.deepEqual(
    r.flags.map((f) => f.transaction.id),
    ["manual"],
  );
  assert.equal(r.historyCount, 2);
  const small = review(
    [1, 2, 3]
      .map((i) => txn(`p${i}`, 100, iso(2026, 10, i), { merchant: "Cafe" }))
      .concat(txn("new", 400, undefined, { merchant: "Cafe" })),
  );
  assert.equal(small.flags.length, 0);
});
test("category fallback needs five samples and excludes transfers, pending and other currencies", () => {
  const past = [1, 2, 3, 4, 5].map((i) =>
    txn(`prior${i}`, 10000, iso(2026, 10, i)),
  );
  assert.match(
    review([...past, txn("large", 100000)]).flags[0].reason,
    /category median/,
  );
  assert.equal(
    review([
      ...past.slice(0, 4),
      txn("pending-history", 10000, iso(2026, 10, 7), { status: "pending" }),
      txn("large", 100000),
    ]).flags.length,
    0,
  );
});
test("invalid months and unsafe financial amounts fail clearly without mutating source records", () => {
  for (const month of ["2026-13", "2026-1", "2027-01", "1899-12"])
    assert.throws(() => review([], { month }));
  assert.throws(() => review([txn("unsafe", Number.MAX_SAFE_INTEGER + 1)]));
  const rows = [txn("b", 20000), txn("a", 10000)],
    before = structuredClone(rows);
  review(rows);
  assert.deepEqual(rows, before);
});
