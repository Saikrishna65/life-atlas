import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import {
  AccountService,
  BalanceService,
  IndexedDBUnitOfWork,
  TransactionService,
} from "@/lib/finance";
import { deleteFinanceDB } from "@/lib/finance/storage/indexeddb/database";
import {
  saveSharedGroup,
  listSharedGroups,
} from "@/lib/finance/shared/service";
import { balances, type SharedGroup } from "@/lib/finance/shared/domain";
import { validateSharedLedgerLinks } from "@/lib/finance/shared/transactionSplit";
import { REPAYMENT_CATEGORY_ID } from "@/lib/finance/shared/repayment";
import { buildMonthlyReview } from "@/lib/finance/review/monthlyReview";
import { localFinanceDateKey } from "@/lib/finance/calendar";
import { snapshotVault } from "@/lib/control-room/local";
import { validateBackup, type BackupPayload } from "@/lib/control-room/backup";
import { FinanceReadCache } from "@/lib/finance/application/readCache";
let uow: IndexedDBUnitOfWork,
  service: TransactionService,
  bank: string,
  expenseId: string;
const selection = { groupId: "room", memberId: "friend" };
async function room() {
  return (await listSharedGroups()).find((g) => g.id === "room")!;
}
const receive = (amountPaise = 50000, extra: Record<string, unknown> = {}) =>
  service.recordTransaction({
    accountId: bank,
    direction: "inflow",
    description: "Ravi room repayment",
    amountPaise,
    paymentKind: "salary",
    categoryId: "cat_salary",
    sharedRepayment: selection,
    ...extra,
  });
beforeEach(async () => {
  await deleteFinanceDB();
  uow = new IndexedDBUnitOfWork();
  service = new TransactionService(uow, async () => []);
  bank = (
    await new AccountService(uow).createAccount({
      name: "Bank",
      accountType: "bank",
      openingBalancePaise: 500000,
    })
  ).id;
  const now = new Date().toISOString();
  await saveSharedGroup("room", 0, () => ({
    schemaVersion: 1,
    id: "room",
    title: "Room expenses",
    currency: "INR",
    selfId: "me",
    members: [
      { id: "me", name: "You" },
      { id: "friend", name: "Ravi" },
    ],
    expenses: [],
    settlements: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
  }));
  expenseId = (
    await service.recordTransaction({
      accountId: bank,
      direction: "outflow",
      description: "Shared groceries",
      amountPaise: 100000,
      sharedSplit: { groupId: "room", memberIds: ["me", "friend"] },
      categoryId: "cat_groceries",
    })
  ).id;
});
afterEach(async () => {
  await deleteFinanceDB();
});
test("a received repayment credits the bank once, settles the group and reduces expenses instead of earnings", async () => {
  const t = await receive();
  assert.equal(t.paymentKind, "reimbursement");
  assert.equal(t.categoryId, REPAYMENT_CATEGORY_ID);
  assert.equal((await uow.accounts.getById(bank))?.currentBalancePaise, 450000);
  const g = await room();
  assert.deepEqual(balances(g), { me: 0, friend: 0 });
  assert.equal(g.settlements[0].sourceTransactionId, t.id);
  assert.equal((await uow.transactions.query({})).length, 2);
  const flow = await new BalanceService(uow).getCashFlow(
    "2000-01-01T00:00:00Z",
    "2100-01-01T00:00:00Z",
  );
  assert.equal(flow.totalIncomePaise, 0);
  assert.equal(flow.totalExpensesPaise, 50000);
  validateSharedLedgerLinks(await uow.transactions.query({}), [g]);
});
test("partial repayments leave only the unpaid amount outstanding", async () => {
  await receive(20000);
  assert.deepEqual(balances(await room()), { me: 30000, friend: -30000 });
  await receive(30000, { description: "Remaining room repayment" });
  assert.deepEqual(balances(await room()), { me: 0, friend: 0 });
});
test("overpayments require explicit confirmation and then become an actual credit", async () => {
  await assert.rejects(receive(60000), /exceeds/);
  assert.equal((await room()).settlements.length, 0);
  assert.equal((await uow.transactions.query({})).length, 1);
  await receive(60000, {
    sharedRepayment: { ...selection, allowOverpayment: true },
  });
  assert.deepEqual(balances(await room()), { me: -10000, friend: 10000 });
});
test("wrong people, currencies, groups, pending payments and transfers roll back every bank write", async () => {
  for (const fields of [
    { sharedRepayment: { ...selection, memberId: "me" } },
    { sharedRepayment: { ...selection, memberId: "missing" } },
    { sharedRepayment: { ...selection, groupId: "missing" } },
    { status: "pending" },
    { direction: "outflow" },
    { sharedSplit: { groupId: "room", memberIds: ["me", "friend"] } },
  ])
    await assert.rejects(receive(50000, fields));
  assert.equal((await uow.transactions.query({})).length, 1);
  assert.equal((await room()).settlements.length, 0);
});
test("editing repayment amounts updates one linked settlement and preserves a stable identity", async () => {
  const t = await receive(20000),
    id = (await room()).settlements[0].id;
  await service.correctTransaction(
    t.id,
    { amountPaise: 30000 },
    "Correct amount",
  );
  assert.equal((await room()).settlements.length, 1);
  assert.equal((await room()).settlements[0].id, id);
  assert.deepEqual(balances(await room()), { me: 20000, friend: -20000 });
});
test("clearing a match restores its original income kind and category without changing the bank credit", async () => {
  const t = await receive();
  await service.correctTransaction(
    t.id,
    { sharedRepayment: null },
    "Not a room repayment",
  );
  const stored = await uow.transactions.getById(t.id);
  assert.equal(stored?.sharedRepayment, undefined);
  assert.equal(stored?.paymentKind, "salary");
  assert.equal(stored?.categoryId, "cat_salary");
  assert.ok((await room()).settlements[0].voidedAt);
  assert.deepEqual(balances(await room()), { me: 50000, friend: -50000 });
  assert.equal((await uow.accounts.getById(bank))?.currentBalancePaise, 450000);
});
test("reversal and deletion restore group debt along with the real bank balance", async () => {
  const t = await receive();
  await service.reverseTransaction(t.id, "Transfer reversed");
  assert.deepEqual(balances(await room()), { me: 50000, friend: -50000 });
  assert.equal((await uow.accounts.getById(bank))?.currentBalancePaise, 400000);
  const other = await receive(20000, { description: "Replacement repayment" });
  await service.deleteTransaction(other.id);
  assert.deepEqual(balances(await room()), { me: 50000, friend: -50000 });
});
test("a late audit failure rolls back the repayment, settlement and category creation together", async () => {
  const audit = (await uow.audit.getAll())[0],
    commit = uow.commitLedgerChange.bind(uow);
  uow.commitLedgerChange = (change) =>
    commit({ ...change, audit: [...change.audit, audit] });
  await assert.rejects(receive());
  assert.equal((await room()).settlements.length, 0);
  assert.equal((await uow.transactions.query({})).length, 1);
  assert.equal(await uow.categories.getById(REPAYMENT_CATEGORY_ID), null);
});
test("stale editors and competing repayments cannot overwrite or over-settle the balance", async () => {
  const result = await Promise.allSettled([
    receive(40000),
    receive(30000, { description: "Second transfer" }),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  const t = await uow.transactions.query({ direction: "inflow" });
  await service.correctTransaction(
    t[0].id,
    { expectedVersion: t[0].version, description: "Reviewed repayment" },
    "Review",
  );
  await assert.rejects(
    service.correctTransaction(
      t[0].id,
      { expectedVersion: t[0].version, amountPaise: 10000 },
      "Stale edit",
    ),
    /changed/,
  );
});
test("an existing manual repayment can be linked without recording the payment twice", async () => {
  const g = await room();
  await saveSharedGroup(g.id, g.version, (current) => {
    current!.settlements.push({
      id: "manual",
      fromId: "friend",
      toId: "me",
      amountPaise: 50000,
      date: localFinanceDateKey(new Date()),
      note: "Already received",
      createdAt: new Date().toISOString(),
    });
    return current!;
  });
  await assert.rejects(receive(), /exceeds/);
  const t = await receive(50000, {
    sharedRepayment: { ...selection, settlementId: "manual" },
  });
  assert.equal((await room()).settlements.length, 1);
  assert.equal((await room()).settlements[0].sourceTransactionId, t.id);
  assert.deepEqual(balances(await room()), { me: 0, friend: 0 });
  await service.correctTransaction(
    t.id,
    { sharedRepayment: null },
    "Remove link only",
  );
  assert.equal((await room()).settlements[0].sourceTransactionId, undefined);
  assert.equal((await room()).settlements[0].voidedAt, undefined);
  assert.deepEqual(balances(await room()), { me: 0, friend: 0 });
});
test("linked repayments are edited in Atlas Finance, not independently inside a group", async () => {
  await receive();
  const g = await room();
  await assert.rejects(
    saveSharedGroup(g.id, g.version, (current) => {
      current!.settlements[0].amountPaise = 40000;
      return current!;
    }),
    /Atlas Finance/,
  );
});
test("changing a bill after repayment does not block unrelated edits to the actual received payment", async () => {
  const t = await receive();
  await service.reverseTransaction(expenseId, "Bill canceled");
  await service.correctTransaction(
    t.id,
    { description: "Actual money still received" },
    "Clarify",
  );
  assert.deepEqual(balances(await room()), { me: -50000, friend: 50000 });
});
test("monthly review separates reimbursements from earnings and merchant refunds", async () => {
  await receive(20000);
  const data = await uow.readDashboardRecords(),
    now = new Date();
  const r = buildMonthlyReview({
    ...data,
    month: localFinanceDateKey(now).slice(0, 7),
    currency: "INR",
    now,
  });
  assert.equal(r.totals.incomePaise, 0);
  assert.equal(r.totals.repaymentsPaise, 20000);
  assert.equal(r.totals.refundsPaise, 0);
  assert.equal(r.totals.spendingPaise, 80000);
});
test("backup validation rejects a mismatched active bank repayment", async () => {
  await receive();
  const vault = await snapshotVault("finance");
  const payload: BackupPayload = {
    format: "life-atlas-v1",
    createdAt: new Date().toISOString(),
    media: false,
    vaults: [vault],
  };
  await validateBackup(payload);
  const group = vault.stores.find((s) => s.name === "shared_groups")!.rows[0]
    .value as SharedGroup;
  group.settlements[0].amountPaise = 40000;
  await assert.rejects(validateBackup(payload), /repayment/);
});
test("snapshot cache shares concurrent reads, reuses them for filters and refreshes after invalidation", async () => {
  const cache = new FinanceReadCache<number>();
  let reads = 0;
  const load = async () => ++reads;
  assert.deepEqual(
    await Promise.all([cache.get(load), cache.get(load)]),
    [1, 1],
  );
  assert.equal(await cache.get(load), 1);
  cache.invalidate();
  assert.equal(await cache.get(load), 2);
});
test("a failed or superseded snapshot cannot poison later finance reads", async () => {
  const cache = new FinanceReadCache<number>();
  await assert.rejects(
    cache.get(async () => {
      throw Error("Offline storage error");
    }),
  );
  assert.equal(await cache.get(async () => 5), 5);
  cache.invalidate();
  let reject!: (reason: Error) => void;
  const stale = cache.get(
    () =>
      new Promise<number>((_, no) => {
        reject = no;
      }),
  );
  const caught = stale.catch(() => 0);
  await Promise.resolve();
  cache.invalidate();
  assert.equal(await cache.get(async () => 9), 9);
  reject(Error("Old failure"));
  await caught;
  assert.equal(await cache.get(async () => 10), 9);
});
test("incoming bank-alert approval matches a repayment without requiring an income category", async () => {
  const { NotificationTrackingService } = await import(
    "@/lib/finance/application/notificationTrackingService"
  );
  const { CategorizationService } = await import(
    "@/lib/finance/application/categorizationService"
  );
  const tracker = new NotificationTrackingService(
    uow,
    service,
    new CategorizationService(uow),
  );
  const now = new Date().toISOString();
  await tracker.processRawEvents([
    {
      id: "incoming",
      packageName: "com.google.android.apps.messaging",
      sender: "VK-KOTAKB",
      title: "VK-KOTAKB",
      text: "Received Rs. 500.00 in your Kotak Bank A/c ...1234 from RAVI via UPI on 27-Nov-26. Ref: 998877665544.",
      postTime: Date.now(),
      postTimeIso: now,
    },
  ]);
  const item = tracker.getReviewQueue()[0];
  assert.ok(item);
  await tracker.resolveReviewItem(
    item.id,
    bank,
    undefined,
    undefined,
    selection,
  );
  assert.equal(tracker.getReviewQueue().length, 0);
  assert.deepEqual(balances(await room()), { me: 0, friend: 0 });
  assert.equal(
    (await uow.transactions.query({ direction: "inflow" }))[0].paymentKind,
    "reimbursement",
  );
});
test("repayment references survive an encrypted Finance backup and restore", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: new EventTarget(),
  });
  try {
    const { encryptPayload, decryptArchive, previewRestore, restoreBackup } =
      await import("@/lib/control-room/backup");
    await receive(20000);
    const payload: BackupPayload = {
      format: "life-atlas-v1",
      createdAt: new Date().toISOString(),
      media: false,
      vaults: [await snapshotVault("finance")],
    };
    const recovered = await decryptArchive(
      await encryptPayload(payload, "synthetic-repayment-backup"),
      "synthetic-repayment-backup",
    );
    const plan = await previewRestore(recovered);
    await restoreBackup(
      plan.payload,
      "synthetic-repayment-backup",
      plan.fingerprint,
    );
    const transactions = await uow.transactions.query({});
    validateSharedLedgerLinks(transactions, [await room()]);
    assert.equal(transactions.filter((t) => t.sharedRepayment).length, 1);
    assert.deepEqual(balances(await room()), { me: 30000, friend: -30000 });
  } finally {
    if (previousWindow)
      Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
test("reimbursement offsets cannot inflate category shares above 100 percent", async () => {
  await receive();
  const { categoryComparisons } = await import(
    "@/lib/finance/categoryComparison"
  );
  const records = await uow.readDashboardRecords();
  const rows = categoryComparisons(
    records.transactions,
    records.categories,
    "month",
  );
  assert.equal(rows.find((r) => r.id === "cat_groceries")?.share, 100);
  assert.equal(
    rows.find((r) => r.id === REPAYMENT_CATEGORY_ID)?.currentPaise,
    -50000,
  );
  assert.ok(rows.every((r) => r.share >= 0 && r.share <= 100));
});
test('linked Finance backups remain valid after changing device time zones',async()=>{const previous=process.env.TZ;try{process.env.TZ='Asia/Kolkata';await service.correctTransaction(expenseId,{occurredAt:'2026-11-27T23:30:00.000Z'},'Travel date');await receive(20000,{occurredAt:'2026-11-27T23:30:00.000Z'});process.env.TZ='UTC';validateSharedLedgerLinks(await uow.transactions.query({}),[await room()]);const payload:BackupPayload={format:'life-atlas-v1',createdAt:new Date().toISOString(),media:false,vaults:[await snapshotVault('finance')]};await validateBackup(payload);}finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}});
