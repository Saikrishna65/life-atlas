/** Local shared-expense records. Amounts use integer minor units; no FX or bank writes. */
export type SplitMode = "equal" | "exact" | "percentage";
export interface Member {
  id: string;
  name: string;
}
export interface Share {
  memberId: string;
  amountPaise: number;
}
export interface SharedExpense {
  sourceTransactionId?: string;
  id: string;
  title: string;
  amountPaise: number;
  payerId: string;
  shares: Share[];
  splitMode: SplitMode;
  weights: number[];
  date: string;
  createdAt: string;
  voidedAt?: string;
}
export interface Settlement {
  id: string;
  fromId: string;
  toId: string;
  amountPaise: number;
  date: string;
  note: string;
  createdAt: string;
  voidedAt?: string;
}
export interface SharedGroup {
  schemaVersion: 1;
  id: string;
  title: string;
  currency: string;
  selfId: string;
  members: Member[];
  tripId?: string;
  tripTitle?: string;
  expenses: SharedExpense[];
  settlements: Settlement[];
  createdAt: string;
  updatedAt: string;
  version: number;
}
export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function amount(value: number, positive = false) {
  ensure(
    Number.isSafeInteger(value) && value >= (positive ? 1 : 0),
    "Enter a valid amount with at most two decimal places.",
  );
}
function sum(values: number[]) {
  return values.reduce((a, b) => {
    const next = a + b;
    ensure(Number.isSafeInteger(next), "The group total is too large.");
    return next;
  }, 0);
}
export function allocate(
  total: number,
  ids: string[],
  mode: SplitMode,
  weights: number[] = [],
): Share[] {
  amount(total, true);
  ensure(
    ids.length > 0 && new Set(ids).size === ids.length,
    "Choose each participant once.",
  );
  ensure(
    ["equal", "exact", "percentage"].includes(mode),
    "Choose a split method.",
  );
  if (mode === "exact") {
    ensure(weights.length === ids.length, "Enter every share.");
    weights.forEach((v) => amount(v));
    ensure(
      sum(weights) === total,
      "The shares must add up to the expense total.",
    );
    return ids.map((memberId, i) => ({ memberId, amountPaise: weights[i] }));
  }
  const values = mode === "equal" ? ids.map(() => 1) : weights;
  ensure(values.length === ids.length, "Enter every percentage.");
  values.forEach((v) => amount(v));
  const denominator = sum(values);
  ensure(
    mode !== "percentage" || denominator === 10000,
    "Percentages must add up to 100%.",
  );
  const parts = values.map((v, i) => {
    const product = BigInt(total) * BigInt(v);
    return {
      i,
      value: Number(product / BigInt(denominator)),
      remainder: product % BigInt(denominator),
    };
  });
  const remaining = total - sum(parts.map((p) => p.value));
  const ranked = [...parts].sort((a, b) =>
    a.remainder === b.remainder
      ? a.i - b.i
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (let i = 0; i < remaining; i++) ranked[i].value++;
  return parts.map((p) => ({ memberId: ids[p.i], amountPaise: p.value }));
}
export function balances(group: SharedGroup): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries(
    group.members.map((m) => [m.id, 0]),
  );
  const add = (id: string, value: number) => {
    ensure(Object.hasOwn(result, id), "A participant is missing.");
    result[id] = sum([result[id], value]);
  };
  for (const e of group.expenses)
    if (!e.voidedAt) {
      add(e.payerId, e.amountPaise);
      for (const s of e.shares) add(s.memberId, -s.amountPaise);
    }
  for (const s of group.settlements)
    if (!s.voidedAt) {
      add(s.fromId, s.amountPaise);
      add(s.toId, -s.amountPaise);
    }
  ensure(sum(Object.values(result)) === 0, "Group balances do not reconcile.");
  return result;
}
export function suggestions(group: SharedGroup) {
  const b = balances(group),
    debtors = group.members
      .filter((m) => b[m.id] < 0)
      .map((m) => ({ id: m.id, left: -b[m.id] })),
    creditors = group.members
      .filter((m) => b[m.id] > 0)
      .map((m) => ({ id: m.id, left: b[m.id] }));
  const result: { fromId: string; toId: string; amountPaise: number }[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amountPaise = Math.min(debtors[i].left, creditors[j].left);
    result.push({ fromId: debtors[i].id, toId: creditors[j].id, amountPaise });
    debtors[i].left -= amountPaise;
    creditors[j].left -= amountPaise;
    if (!debtors[i].left) i++;
    if (!creditors[j].left) j++;
  }
  return result;
}
function text(value: unknown, max: number, empty = false) {
  ensure(
    typeof value === "string" &&
      value.length <= max &&
      (empty || value.trim().length > 0),
    "A name or description is invalid.",
  );
}
function date(value: unknown) {
  ensure(
    typeof value === "string" && Number.isFinite(Date.parse(value)),
    "Choose a valid date.",
  );
}
function calendarDate(value: unknown) {
  date(value);
  ensure(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Choose a valid calendar date.",
  );
}
export function validateGroup(value: unknown): asserts value is SharedGroup {
  ensure(value && typeof value === "object", "Invalid shared group.");
  const g = value as SharedGroup;
  ensure(
    g.schemaVersion === 1 && Number.isSafeInteger(g.version) && g.version > 0,
    "Unsupported shared group version.",
  );
  text(g.id, 100);
  text(g.title, 120);
  ensure(
    ["INR", "USD", "EUR", "GBP"].includes(g.currency),
    "Unsupported group currency.",
  );
  date(g.createdAt);
  date(g.updatedAt);
  if (g.tripId !== undefined) {
    text(g.tripId, 100);
    text(g.tripTitle, 200);
  }
  ensure(
    Array.isArray(g.members) && g.members.length >= 2 && g.members.length <= 30,
    "Use between 2 and 30 people.",
  );
  const ids = new Set<string>();
  for (const m of g.members) {
    text(m.id, 100);
    text(m.name, 80);
    ensure(!ids.has(m.id), "Duplicate participant.");
    ids.add(m.id);
  }
  ensure(ids.has(g.selfId), "Your participant record is missing.");
  ensure(
    Array.isArray(g.expenses) &&
      Array.isArray(g.settlements) &&
      g.expenses.length <= 5000 &&
      g.settlements.length <= 5000,
    "This group has too many records.",
  );
  const records = new Set<string>();
  const sourceIds = new Set<string>();
  for (const e of g.expenses) {
    if (e.sourceTransactionId !== undefined) { text(e.sourceTransactionId, 100); ensure(!sourceIds.has(e.sourceTransactionId), "This payment is already split in this group."); sourceIds.add(e.sourceTransactionId); }
    text(e.id, 100);
    ensure(!records.has(e.id), "Duplicate expense.");
    records.add(e.id);
    text(e.title, 160);
    calendarDate(e.date);
    date(e.createdAt);
    if (e.voidedAt !== undefined) date(e.voidedAt);
    amount(e.amountPaise, true);
    ensure(
      ids.has(e.payerId) && Array.isArray(e.shares) && Array.isArray(e.weights),
      "Invalid expense participants.",
    );
    ensure(
      e.splitMode !== "equal" || e.weights.length === 0,
      "Equal splits do not use custom weights.",
    );
    const expected = allocate(
      e.amountPaise,
      e.shares.map((s) => s.memberId),
      e.splitMode,
      e.weights,
    );
    e.shares.forEach((s, i) =>
      ensure(
        ids.has(s.memberId) && s.amountPaise === expected[i].amountPaise,
        "The expense shares do not reconcile.",
      ),
    );
  }
  for (const s of g.settlements) {
    text(s.id, 100);
    ensure(!records.has(s.id), "Duplicate payment.");
    records.add(s.id);
    amount(s.amountPaise, true);
    calendarDate(s.date);
    date(s.createdAt);
    if (s.voidedAt !== undefined) date(s.voidedAt);
    text(s.note, 500, true);
    ensure(
      ids.has(s.fromId) && ids.has(s.toId) && s.fromId !== s.toId,
      "Choose two different people.",
    );
  }
  balances(g);
}
export function checkSettlement(
  group: SharedGroup,
  payment: Pick<Settlement, "fromId" | "toId" | "amountPaise">,
  confirmed: boolean,
  allowOverpayment = false,
) {
  ensure(confirmed, "Confirm that this payment already happened.");
  amount(payment.amountPaise, true);
  const b = balances(group);
  ensure(
    Object.hasOwn(b, payment.fromId) &&
      Object.hasOwn(b, payment.toId) &&
      payment.fromId !== payment.toId,
    "Choose two different people.",
  );
  ensure(
    allowOverpayment ||
      (b[payment.fromId] < 0 &&
        b[payment.toId] > 0 &&
        payment.amountPaise <= Math.min(-b[payment.fromId], b[payment.toId])),
    "This exceeds the current balance. Confirm an overpayment only if it really happened.",
  );
}
