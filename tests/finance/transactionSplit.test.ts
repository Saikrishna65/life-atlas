import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import {
  AccountService,
  TransactionService,
  CategorizationService,
  IndexedDBUnitOfWork,
} from "@/lib/finance";
import { deleteFinanceDB } from "@/lib/finance/storage/indexeddb/database";
import {
  listSharedGroups,
  saveSharedGroup,
} from "@/lib/finance/shared/service";
import { balances, type SharedGroup } from "@/lib/finance/shared/domain";
import { validateSharedLedgerLinks } from "@/lib/finance/shared/transactionSplit";
import { snapshotVault } from "@/lib/control-room/local";
import { validateBackup, type BackupPayload } from "@/lib/control-room/backup";
import { NotificationTrackingService } from "@/lib/finance/application/notificationTrackingService";
let uow: IndexedDBUnitOfWork, service: TransactionService, accountId: string;
const now = new Date().toISOString();
const split = { groupId: "room", memberIds: ["me", "friend"] };
function group(id = "room", currency = "INR"): SharedGroup {
  return {
    schemaVersion: 1,
    id,
    title: "Room expenses",
    currency,
    selfId: "me",
    members: [
      { id: "me", name: "You" },
      { id: "friend", name: "Ravi" },
    ],
    expenses: [],
    settlements: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}
const purchase = (extra: Record<string, unknown> = {}) =>
  service.recordTransaction({
    accountId,
    description: "Shared groceries",
    amountPaise: 100000,
    direction: "outflow",
    categoryId: "cat_groceries",
    sharedSplit: split,
    ...extra,
  });
beforeEach(async () => {
  await deleteFinanceDB();
  uow = new IndexedDBUnitOfWork();
  service = new TransactionService(uow, async () => []);
  accountId = (
    await new AccountService(uow).createAccount({
      name: "Room bank",
      accountType: "bank",
      openingBalancePaise: 500000,
    })
  ).id;
  await saveSharedGroup("room", 0, () => group());
});
afterEach(async () => {
  await deleteFinanceDB();
});
test("one bank expense and one linked equal split commit together without doubling spending", async () => {
  const t = await purchase();
  const g = (await listSharedGroups())[0];
  assert.equal((await uow.transactions.query({})).length, 1);
  assert.equal(g.expenses.length, 1);
  assert.equal(g.expenses[0].sourceTransactionId, t.id);
  assert.deepEqual(balances(g), { me: 50000, friend: -50000 });
  assert.equal(
    (await uow.accounts.getById(accountId))?.currentBalancePaise,
    400000,
  );
  validateSharedLedgerLinks([t], [g]);
});
test("invalid or cross-currency groups roll back the bank journal, balances and outbox", async () => {
  const baseline = (await uow.outbox.getAll()).length;
  await assert.rejects(
    purchase({ sharedSplit: { ...split, groupId: "missing" } }),
    /no longer available/,
  );
  await saveSharedGroup("usd", 0, () => group("usd", "USD"));
  await assert.rejects(
    purchase({ sharedSplit: { ...split, groupId: "usd" } }),
    /same currency/,
  );
  assert.equal((await uow.transactions.query({})).length, 0);
  assert.equal(
    (await uow.accounts.getById(accountId))?.currentBalancePaise,
    500000,
  );
  assert.equal((await uow.outbox.getAll()).length, baseline);
});
test("missing or duplicate participants and unsupported payment types never post partially", async () => {
  await assert.rejects(
    purchase({ sharedSplit: { ...split, memberIds: ["missing"] } }),
    /people changed/,
  );
  await assert.rejects(
    purchase({ sharedSplit: { ...split, memberIds: ["me", "me"] } }),
  );
  for (const extra of [
    { direction: "inflow" },
    { paymentKind: "transfer" },
    { categoryId: "cat_transfer" },
    { status: "pending" },
  ])
    await assert.rejects(purchase(extra));
  assert.equal((await uow.transactions.query({})).length, 0);
  assert.equal((await listSharedGroups())[0].expenses.length, 0);
});
test("editing a linked payment recalculates the same group expense, preserving repayments", async () => {
  const t = await purchase();
  const g = (await listSharedGroups())[0];
  const expenseId = g.expenses[0].id;
  await saveSharedGroup(g.id, g.version, (current) => {
    current!.settlements.push({
      id: "paid",
      fromId: "friend",
      toId: "me",
      amountPaise: 20000,
      note: "",
      date: "2026-11-27",
      createdAt: now,
    });
    return current!;
  });
  await service.correctTransaction(
    t.id,
    { expectedVersion: t.version, amountPaise: 80000 },
    "Receipt correction",
  );
  const changed = (await listSharedGroups())[0];
  assert.equal(changed.expenses.length, 1);
  assert.equal(changed.expenses[0].id, expenseId);
  assert.deepEqual(balances(changed), { me: 20000, friend: -20000 });
  assert.equal(changed.settlements.length, 1);
});
test("Just me cancels the linked expense but preserves actual repayments and the bank payment", async () => {
  const t = await purchase();
  const g = (await listSharedGroups())[0];
  await saveSharedGroup(g.id, g.version, (current) => {
    current!.settlements.push({
      id: "paid",
      fromId: "friend",
      toId: "me",
      amountPaise: 20000,
      note: "",
      date: "2026-11-27",
      createdAt: now,
    });
    return current!;
  });
  await service.correctTransaction(
    t.id,
    { sharedSplit: null },
    "Personal purchase",
  );
  const changed = (await listSharedGroups())[0];
  assert.ok(changed.expenses[0].voidedAt);
  assert.deepEqual(balances(changed), { me: -20000, friend: 20000 });
  assert.equal((await uow.transactions.getById(t.id))?.amountPaise, 100000);
  assert.equal(
    (await uow.accounts.getById(accountId))?.currentBalancePaise,
    400000,
  );
});
test("moving groups and returning to the first group reuses the original linked expense", async () => {
  await saveSharedGroup("trip", 0, () => group("trip"));
  const t = await purchase();
  await service.correctTransaction(
    t.id,
    { sharedSplit: { ...split, groupId: "trip" } },
    "Different group",
  );
  let groups = await listSharedGroups();
  assert.ok(groups.find((g) => g.id === "room")!.expenses[0].voidedAt);
  assert.equal(groups.find((g) => g.id === "trip")!.expenses.length, 1);
  await service.correctTransaction(
    t.id,
    { sharedSplit: split },
    "Back to room",
  );
  groups = await listSharedGroups();
  assert.equal(groups.find((g) => g.id === "room")!.expenses.length, 1);
  assert.equal(
    groups.find((g) => g.id === "room")!.expenses[0].voidedAt,
    undefined,
  );
});
test("reversal cancels the group expense and restores the original bank balance", async () => {
  const t = await purchase();
  await service.reverseTransaction(t.id, "Wrong entry");
  const g = (await listSharedGroups())[0];
  assert.ok(g.expenses[0].voidedAt);
  assert.deepEqual(balances(g), { me: 0, friend: 0 });
  assert.equal(
    (await uow.accounts.getById(accountId))?.currentBalancePaise,
    500000,
  );
});
test("stale editors cannot change either the bank amount or its linked expense", async () => {
  const t = await purchase();
  await service.correctTransaction(
    t.id,
    { expectedVersion: t.version, amountPaise: 80000 },
    "Correction",
  );
  await assert.rejects(
    service.correctTransaction(
      t.id,
      { expectedVersion: t.version, amountPaise: 50000 },
      "Stale correction",
    ),
    /changed/,
  );
  assert.equal((await listSharedGroups())[0].expenses[0].amountPaise, 80000);
});
test("linked expenses cannot be edited or detached from the shared group workspace", async () => {
  await purchase();
  const g = (await listSharedGroups())[0];
  await assert.rejects(
    saveSharedGroup(g.id, g.version, (current) => {
      current!.expenses[0].title = "Independent edit";
      return current!;
    }),
    /Atlas Finance/,
  );
  assert.equal(
    (await listSharedGroups())[0].expenses[0].title,
    "Shared groceries",
  );
});
test("concurrent bank payments preserve both splits and a later category correction creates no duplicate", async () => {
  const [one, two] = await Promise.all([
    purchase(),
    purchase({ description: "Shared dinner", amountPaise: 60000 }),
  ]);
  await service.correctTransaction(
    one.id,
    { categoryId: "cat_food_dining" },
    "Category correction",
  );
  const g = (await listSharedGroups())[0];
  assert.equal(g.expenses.length, 2);
  assert.deepEqual(balances(g), { me: 80000, friend: -80000 });
  validateSharedLedgerLinks(await uow.transactions.query({}), [g]);
  assert.notEqual(one.id, two.id);
});
test("category approval saves the category, clears review and links the split atomically", async () => {
  const t = await purchase({ sharedSplit: undefined, reviewRequired: true });
  const categorizer = new CategorizationService(uow);
  await categorizer.reviewTransaction(t, "cat_food_dining", split, true);
  const stored = await uow.transactions.getById(t.id);
  assert.equal(stored?.reviewRequired, false);
  assert.equal(stored?.categoryId, "cat_food_dining");
  assert.ok((await uow.audit.getAll()).some(event => event.entityId === t.id && event.changes.reviewRequired?.newVal === false));
  assert.equal((await listSharedGroups())[0].expenses.length, 1);
});
test("backup validation rejects a mismatched active linked expense without changing stored data", async () => {
  await purchase();
  const vault = await snapshotVault("finance");
  const payload: BackupPayload = {
    format: "life-atlas-v1",
    createdAt: now,
    media: false,
    vaults: [vault],
  };
  await validateBackup(payload);
  const g = vault.stores.find((s) => s.name === "shared_groups")!.rows[0]
    .value as SharedGroup;
  g.expenses[0].sourceTransactionId = "missing";
  await assert.rejects(validateBackup(payload), /original payment/);
  assert.equal((await listSharedGroups())[0].expenses.length, 1);
});
test("bank alert approval attaches a split once and retrying approval does not duplicate it", async () => {
  const tracker = new NotificationTrackingService(uow, service, new CategorizationService(uow));
  await tracker.processRawEvents([
    {
      id: "room-alert",
      packageName: "com.google.android.apps.messaging",
      sender: "VK-KOTAKB",
      title: "VK-KOTAKB",
      text: "Debited Rs. 1000.00 from Kotak Bank A/c ...XX1234 to GROCERY via UPI. Ref: 429182736451 on 27-Nov-26. Avl Bal: Rs 4,000.00",
      postTime: Date.now(),
      postTimeIso: now,
    },
  ]);
  const pending = tracker.getReviewQueue()[0];
  assert.ok(pending);
  await tracker.resolveReviewItem(
    pending.id,
    accountId,
    "cat_groceries",
    split,
  );
  await tracker.resolveReviewItem(
    pending.id,
    accountId,
    "cat_groceries",
    split,
  );
  assert.equal((await uow.transactions.query({})).length, 1);
  assert.equal((await listSharedGroups())[0].expenses.length, 1);
  assert.equal(tracker.getReviewQueue().length, 0);
});
test("a late journal failure rolls back group allocations and bank writes together", async () => {
  const existingAudit = (await uow.audit.getAll())[0],
    original = uow.commitLedgerChange.bind(uow),
    outboxCount = (await uow.outbox.getAll()).length;
  uow.commitLedgerChange = (change) =>
    original({ ...change, audit: [...change.audit, existingAudit] });
  await assert.rejects(purchase());
  assert.equal((await listSharedGroups())[0].expenses.length, 0);
  assert.equal((await uow.transactions.query({})).length, 0);
  assert.equal(
    (await uow.accounts.getById(accountId))?.currentBalancePaise,
    500000,
  );
  assert.equal((await uow.outbox.getAll()).length, outboxCount);
});
test("deleting a linked bank payment leaves a cancelled history record and no orphan debt", async () => {
  const t = await purchase();
  await service.deleteTransaction(t.id);
  const g = (await listSharedGroups())[0];
  assert.equal(await uow.transactions.getById(t.id), null);
  assert.ok(g.expenses[0].voidedAt);
  assert.deepEqual(balances(g), { me: 0, friend: 0 });
  validateSharedLedgerLinks([], [g]);
});
test('adding a person later never silently changes an already chosen split', async () => {
 const g = (await listSharedGroups())[0]; await saveSharedGroup(g.id, g.version, current => { current!.members.push({ id: 'new', name: 'Sara' }); return current!; });
 await purchase(); const updated = (await listSharedGroups())[0]; assert.deepEqual(balances(updated), { me: 50000, friend: -50000, new: 0 }); assert.equal(updated.expenses[0].shares.length, 2);
});
test('an encrypted backup restores linked bank payments and shared expenses together', async () => {
 const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window'); Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
 try {
  const { encryptPayload, decryptArchive, previewRestore, restoreBackup } = await import('@/lib/control-room/backup');
  const t = await purchase(), original: BackupPayload = { format: 'life-atlas-v1', createdAt: now, media: false, vaults: [await snapshotVault('finance')] };
  const decoded = await decryptArchive(await encryptPayload(original, 'synthetic-room-backup'), 'synthetic-room-backup');
  await service.correctTransaction(t.id, { amountPaise: 80000 }, 'Test later edit'); const plan = await previewRestore(decoded); await restoreBackup(plan.payload, 'synthetic-room-backup', plan.fingerprint);
  const transactions = await uow.transactions.query({}), groups = await listSharedGroups(); validateSharedLedgerLinks(transactions, groups); assert.equal(transactions.length, 1); assert.equal(transactions[0].amountPaise, 100000); assert.deepEqual(balances(groups[0]), { me: 50000, friend: -50000 });
 } finally { if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window'); }
});
