/**
 * Life Atlas Finance: Notification Tracking Service Automated Test Suite
 * 
 * Verifies:
 * 1. Triple-Source Deduplication (Kotak App + SMS + Truecaller for the same transaction).
 * 2. Distinct transactions with different references recorded properly.
 * 3. Matching Kotak accounts by mask / name.
 * 4. Staging unmatched accounts into the review queue.
 * 5. Review queue resolution and dismissal.
 * 6. Strict rejection of OTPs and promotional messages.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  deleteFinanceDB,
  IndexedDBUnitOfWork,
  AccountService,
  TransactionService,
  BalanceService,
  CategorizationService,
  NotificationTrackingService,
  RawNotificationEvent,
  rupeesToPaise,
} from "@/lib/finance";

describe("Life Atlas Finance: Kotak Notification Tracking Service", () => {
  let uow: IndexedDBUnitOfWork;
  let accountService: AccountService;
  let transactionService: TransactionService;
  let balanceService: BalanceService;
  let categorizationService: CategorizationService;
  let trackingService: NotificationTrackingService;
  let kotakAccountId: string;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    accountService = new AccountService(uow);
    transactionService = new TransactionService(uow);
    balanceService = new BalanceService(uow);
    categorizationService = new CategorizationService(uow);
    trackingService = new NotificationTrackingService(
      uow,
      transactionService,
      categorizationService
    );

    await uow.categories.seedDefaults();
    await uow.categorizationRules.seedDefaults();

    // Create a Kotak 811 account with mask 1234
    const kotakAccount = await accountService.createAccount({
      name: "Kotak 811 Savings",
      accountType: "bank",
      currency: "INR",
      openingBalancePaise: rupeesToPaise(10000),
      metadata: {
        institutionName: "Kotak Mahindra Bank",
        accountNumberLast4: "1234",
      },
    });
    kotakAccountId = kotakAccount.id;
  });

  afterEach(async () => {
    await deleteFinanceDB();
  });

  test("triple-source deduplication: Kotak App + SMS + Truecaller produces exactly 1 ledger transaction", async () => {
    const appEvent: RawNotificationEvent = {
      id: "evt_app_01",
      packageName: "com.msf.kbank.mobile",
      sender: "Kotak Bank",
      title: "Sent Rs. 450.00",
      text: "Sent Rs. 450.00 from Kotak Bank AC X1234 to SWIGGY on 27-Oct-26. UPI Ref 429182736451.",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T14:30:00.000Z",
    };

    const smsEvent: RawNotificationEvent = {
      id: "evt_sms_01",
      packageName: "com.google.android.apps.messaging",
      sender: "VK-KOTAKB",
      title: "VK-KOTAKB",
      text: "Debited Rs. 450.00 from Kotak Bank A/c ...XX1234 to SWIGGY via UPI. Ref: 429182736451 on 27-Oct-26. Avl Bal: Rs 9,550.00",
      postTime: Date.now() + 1000,
      postTimeIso: "2026-10-27T14:30:01.000Z",
    };

    const truecallerEvent: RawNotificationEvent = {
      id: "evt_tc_01",
      packageName: "com.truecaller",
      sender: "Kotak Mahindra Bank",
      title: "Kotak Mahindra Bank",
      text: "Debited Rs. 450.00 from Kotak Bank AC X1234 to SWIGGY on 27-Oct-26. UPI Ref 429182736451.",
      postTime: Date.now() + 2000,
      postTimeIso: "2026-10-27T14:30:02.000Z",
    };

    // Process all three events together
    const result = await trackingService.processRawEvents([appEvent, smsEvent, truecallerEvent]);

    assert.strictEqual(result.processed, 1, "Only one unique transaction should be recorded");
    assert.strictEqual(result.duplicates, 2, "Two duplicate events should be suppressed");

    // Verify ledger has exactly 1 transaction
    const txns = await uow.transactions.query({ accountId: kotakAccountId });
    assert.strictEqual(txns.length, 1);
    assert.strictEqual(txns[0].amountPaise, rupeesToPaise(450));
    assert.strictEqual(txns[0].direction, "outflow");
    assert.strictEqual(txns[0].merchant, "Swiggy");
    assert.strictEqual(txns[0].externalId, "kotak_notif_429182736451");

    // Verify account balance updated accurately (10000 - 450 = 9550)
    const balances = await balanceService.getAccountBalances(kotakAccountId);
    assert.strictEqual(balances.postedBalancePaise, rupeesToPaise(9550));
    assert.strictEqual(balances.availableBalancePaise, rupeesToPaise(9550));
  });

  test("two distinct transactions with different UTRs at the same merchant are both recorded", async () => {
    const txn1: RawNotificationEvent = {
      id: "evt_t1",
      packageName: "com.msf.kbank.mobile",
      sender: "Kotak Bank",
      title: "Sent Rs. 200.00",
      text: "Sent Rs. 200.00 from Kotak Bank AC X1234 to SWIGGY on 27-Oct-26. UPI Ref 111111111111.",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T12:00:00.000Z",
    };

    const txn2: RawNotificationEvent = {
      id: "evt_t2",
      packageName: "com.msf.kbank.mobile",
      sender: "Kotak Bank",
      title: "Sent Rs. 350.00",
      text: "Sent Rs. 350.00 from Kotak Bank AC X1234 to SWIGGY on 27-Oct-26. UPI Ref 222222222222.",
      postTime: Date.now() + 3600000,
      postTimeIso: "2026-10-27T13:00:00.000Z",
    };

    const result = await trackingService.processRawEvents([txn1, txn2]);
    assert.strictEqual(result.processed, 2);
    assert.strictEqual(result.duplicates, 0);

    const txns = await uow.transactions.query({ accountId: kotakAccountId });
    assert.strictEqual(txns.length, 2);
    const sortedAmounts = txns.map((t) => t.amountPaise).sort((a, b) => a - b);
    assert.deepStrictEqual(sortedAmounts, [rupeesToPaise(200), rupeesToPaise(350)]);
  });

  test("unmatched Kotak account routes transaction to review queue without creating phantom data", async () => {
    // Delete Kotak account so there is no matching account
    await uow.accounts.delete(kotakAccountId);

    const event: RawNotificationEvent = {
      id: "evt_no_account",
      packageName: "com.msf.kbank.mobile",
      sender: "Kotak Bank",
      title: "Sent Rs. 150.00",
      text: "Sent Rs. 150.00 from Kotak Bank AC X9999 to CHAI POINT on 27-Oct-26. UPI Ref 998877665544.",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T15:00:00.000Z",
    };

    const result = await trackingService.processRawEvents([event]);
    assert.strictEqual(result.processed, 0, "Should not record in ledger when no account matches");

    // Review queue should contain 1 pending item
    const reviewItems = trackingService.getReviewQueue();
    assert.strictEqual(reviewItems.length, 1);
    assert.strictEqual(reviewItems[0].status, "pending");
    assert.strictEqual(reviewItems[0].parsedTransaction.merchantOrBeneficiary, "Chai Point");
    assert.strictEqual(reviewItems[0].parsedTransaction.amountPaise, rupeesToPaise(150));

    // Ledger should still be empty
    const allTxns = await uow.transactions.query({});
    assert.strictEqual(allTxns.length, 0);

    // Now recreate an account and resolve the review item
    const newAccount = await accountService.createAccount({
      name: "New Kotak Account",
      accountType: "bank",
      currency: "INR",
      openingBalancePaise: rupeesToPaise(5000),
    });

    await trackingService.resolveReviewItem(reviewItems[0].id, newAccount.id);

    // Item should now be approved and cleared from pending queue
    assert.strictEqual(trackingService.getReviewQueue().length, 0);

    // Ledger should have recorded the transaction
    const txns = await uow.transactions.query({ accountId: newAccount.id });
    assert.strictEqual(txns.length, 1);
    assert.strictEqual(txns[0].amountPaise, rupeesToPaise(150));
    assert.strictEqual(txns[0].merchant, "Chai Point");
  });

  test("review item dismissal marks item as dismissed without recording in ledger", async () => {
    await uow.accounts.delete(kotakAccountId);

    const event: RawNotificationEvent = {
      id: "evt_dismiss",
      packageName: "com.msf.kbank.mobile",
      sender: "Kotak Bank",
      title: "Sent Rs. 80.00",
      text: "Sent Rs. 80.00 from Kotak Bank AC X9999 to METRO TICKET on 27-Oct-26. UPI Ref 334455667788.",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T16:00:00.000Z",
    };

    await trackingService.processRawEvents([event]);
    const items = trackingService.getReviewQueue();
    assert.strictEqual(items.length, 1);

    trackingService.dismissReviewItem(items[0].id);
    assert.strictEqual(trackingService.getReviewQueue().length, 0);

    const allTxns = await uow.transactions.query({});
    assert.strictEqual(allTxns.length, 0);
  });

  test("rejects OTP and promotional notifications cleanly without touching ledger or review queue", async () => {
    const otpEvent: RawNotificationEvent = {
      id: "evt_otp",
      packageName: "com.google.android.apps.messaging",
      sender: "VK-KOTAKB",
      title: "VK-KOTAKB",
      text: "123456 is your Kotak OTP. Do not share it.",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T16:10:00.000Z",
    };

    const promoEvent: RawNotificationEvent = {
      id: "evt_promo",
      packageName: "com.google.android.apps.messaging",
      sender: "AD-KOTAKB",
      title: "AD-KOTAKB",
      text: "Get a personal loan up to Rs. 10,00,000 instantly with zero paperwork!",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T16:11:00.000Z",
    };

    const result = await trackingService.processRawEvents([otpEvent, promoEvent]);
    assert.strictEqual(result.processed, 0);
    assert.strictEqual(result.duplicates, 0);
    assert.strictEqual(trackingService.getReviewQueue().length, 0);

    const allTxns = await uow.transactions.query({});
    assert.strictEqual(allTxns.length, 0);
  });
});
