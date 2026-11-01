import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { AccountService, CategorizationService, IndexedDBUnitOfWork, NotificationTrackingService, TransactionService, deleteFinanceDB, type RawNotificationEvent } from "../../src/lib/finance";
import type { IKotakNativePlugin } from "../../src/lib/finance/application/notificationTrackingService";

function alert(id = "one", reference = "111111111111", mask = "1234"): RawNotificationEvent {
  return { id, packageName: "com.google.android.apps.messaging", sender: "VM-KOTAKB", title: "VM-KOTAKB", text: `Sent Rs. 200.00 from Kotak Bank AC X${mask} to SWIGGY. UPI Ref ${reference}.`, postTime: 1793102400000, postTimeIso: "2026-10-27T12:00:00.000Z" };
}
function nativeQueue(events: RawNotificationEvent[]) {
  const state = { events, acknowledgements: [] as string[] };
  const plugin: IKotakNativePlugin = {
    isNotificationAccessGranted: async () => ({ granted: true }),
    requestNotificationAccess: async () => ({ opened: true }),
    getTrackingStatus: async () => ({ enabled: true, permissionGranted: true, lastEventTime: null, lastTransactionTime: null, lastError: null, eventsReceivedCount: events.length, duplicatesIgnoredCount: 0, pendingCount: state.events.length }),
    setTrackingEnabled: async ({ enabled }) => ({ enabled }),
    getPendingNotifications: async () => ({ notifications: [...state.events], count: state.events.length }),
    acknowledgeNotifications: async ({ ids }) => { state.acknowledgements.push(...ids); state.events = state.events.filter((event) => !ids.includes(event.id)); return { success: true, remainingCount: state.events.length }; },
    recordTransactionProcessed: async () => ({ success: true }),
    recordDuplicateIgnored: async () => ({ success: true, count: 1 }),
    clearTrackingData: async () => ({ success: true }),
    addListener: async () => ({ remove() {} }),
  };
  return { state, plugin };
}
describe("Google Messages automatic imports", () => {
  let uow: IndexedDBUnitOfWork;
  let transactions: TransactionService;
  let categories: CategorizationService;
  let accountId: string;
  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    await uow.categories.seedDefaults();
    await uow.categorizationRules.seedDefaults();
    transactions = new TransactionService(uow);
    categories = new CategorizationService(uow);
    const account = await new AccountService(uow).createAccount({ name: "Kotak", accountType: "bank", currency: "INR", openingBalancePaise: 0, metadata: { institutionName: "Kotak", accountNumberLast4: "1234" } });
    accountId = account.id;
  });
  test("concurrent queue drains stage one suggested transaction without touching the ledger", async () => {
    const { plugin, state } = nativeQueue([alert()]);
    const service = new NotificationTrackingService(uow, transactions, categories, plugin);
    await Promise.all([service.drainPendingNotifications(), service.drainPendingNotifications()]);
    assert.equal((await uow.transactions.query({})).length, 0);
    assert.equal(state.events.length, 1);
    const items = service.getReviewQueue();
    assert.equal(items.length, 1);
    assert.equal(items[0].suggestedCategoryId, "cat_food_dining");
    assert.deepEqual(items[0].candidateAccountIds, [accountId]);
    await Promise.all([service.resolveReviewItem(items[0].id, accountId), service.resolveReviewItem(items[0].id, accountId)]);
    assert.equal((await uow.transactions.query({})).length, 1);
    assert.equal(state.events.length, 0);
  });
  test("failed ledger writes remain queued and retry successfully", async () => {
    const { plugin, state } = nativeQueue([alert()]);
    const original = transactions.recordTransaction.bind(transactions);
    transactions.recordTransaction = async () => { throw new Error("Simulated storage failure"); };
    const service = new NotificationTrackingService(uow, transactions, categories, plugin);
    await service.drainPendingNotifications();
    const item = service.getReviewQueue()[0];
    await assert.rejects(service.resolveReviewItem(item.id, accountId), /Simulated storage failure/);
    assert.equal(state.events.length, 1);
    assert.deepEqual(state.acknowledgements, []);
    transactions.recordTransaction = original;
    await service.resolveReviewItem(item.id, accountId);
    assert.equal(state.events.length, 0);
    assert.equal((await uow.transactions.query({})).length, 1);
  });
  test("unmatched mask survives service recreation until reviewed", async () => {
    const { plugin, state } = nativeQueue([alert("unknown", "111111111111", "9999")]);
    const first = new NotificationTrackingService(uow, transactions, categories, plugin);
    await first.drainPendingNotifications();
    assert.equal(first.getReviewQueue().length, 1);
    assert.equal(state.events.length, 1);
    assert.equal((await uow.transactions.query({})).length, 0);
    const reopened = new NotificationTrackingService(uow, transactions, categories, plugin);
    await reopened.drainPendingNotifications();
    await reopened.drainPendingNotifications();
    assert.equal(reopened.getReviewQueue().length, 1);
    await reopened.resolveReviewItem(reopened.getReviewQueue()[0].id, accountId);
    assert.equal(state.events.length, 0);
    assert.equal((await uow.transactions.query({})).length, 1);
  });
  test("different references at the same merchant and amount remain separate", async () => {
    const { plugin } = nativeQueue([alert(), alert("two", "222222222222")]);
    const service = new NotificationTrackingService(uow, transactions, categories, plugin);
    await service.drainPendingNotifications();
    assert.equal(service.getReviewQueue().length, 2);
    for (const item of service.getReviewQueue()) await service.resolveReviewItem(item.id, accountId);
    assert.equal((await uow.transactions.query({})).length, 2);
  });
  test("user can correct the suggested category before approval", async () => {
    const { plugin } = nativeQueue([alert()]);
    const service = new NotificationTrackingService(uow, transactions, categories, plugin);
    await service.drainPendingNotifications();
    const item = service.getReviewQueue()[0];
    assert.equal(item.suggestedCategoryId, "cat_food_dining");
    await service.resolveReviewItem(item.id, accountId, "cat_shopping");
    const rows = await uow.transactions.query({});
    assert.equal(rows[0].categoryId, "cat_shopping");
  });
  test("matching accounts also remain queued across recreation until approved", async () => {
    const { plugin, state } = nativeQueue([alert()]);
    await new NotificationTrackingService(uow, transactions, categories, plugin).drainPendingNotifications();
    const reopened = new NotificationTrackingService(uow, transactions, categories, plugin);
    await reopened.drainPendingNotifications();
    assert.equal(state.events.length, 1);
    assert.equal(reopened.getReviewQueue().length, 1);
    assert.equal((await uow.transactions.query({})).length, 0);
  });
  test("dismissal acknowledges unmatched alert without creating a transaction", async () => {
    const { plugin, state } = nativeQueue([alert("unknown", "111111111111", "9999")]);
    const service = new NotificationTrackingService(uow, transactions, categories, plugin);
    await service.drainPendingNotifications();
    await service.dismissReviewItem(service.getReviewQueue()[0].id);
    assert.equal(state.events.length, 0);
    assert.equal((await uow.transactions.query({})).length, 0);
  });
  test("non-transaction alerts are acknowledged without ledger writes", async () => {
    const event = alert();
    event.text = "123456 is your Kotak OTP. Do not share.";
    const { plugin, state } = nativeQueue([event]);
    await new NotificationTrackingService(uow, transactions, categories, plugin).drainPendingNotifications();
    assert.equal(state.events.length, 0);
    assert.equal((await uow.transactions.query({})).length, 0);
  });
});
