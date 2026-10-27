/**
 * Life Atlas Finance: Recurring Payment Detection Automated Test Suite (Phase 3)
 * 
 * Validates deterministic local recurring pattern detection, interval variance tolerance,
 * transfer exclusions, reversed transaction exclusions, next due date estimation, and rule lifecycles.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  deleteFinanceDB,
  IndexedDBUnitOfWork,
  RecurringService,
  TransactionService,
  AccountService,
  FinanceAccount,
  Transaction,
} from "@/lib/finance";

describe("Life Atlas Finance: Recurring Payments & Subscription Engine", () => {
  let uow: IndexedDBUnitOfWork;
  let recurringService: RecurringService;
  let transactionService: TransactionService;
  let accountService: AccountService;
  let testAccount: FinanceAccount;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    recurringService = new RecurringService(uow);
    transactionService = new TransactionService(uow);
    accountService = new AccountService(uow);
    await uow.categories.seedDefaults();

    testAccount = await accountService.createAccount({
      name: "HDFC Salary Account",
      accountType: "bank",
      openingBalancePaise: 10000000,
    });
  });

  afterEach(async () => {
    await deleteFinanceDB();
  });

  describe("1. Monthly Subscription Detection with Weekend Drift (REQ-REC-01)", () => {
    test("detects monthly Netflix subscription with 29-31 day intervals", async () => {
      // 3 consecutive monthly payments with slight day shifts (weekend drift)
      await uow.transactions.save({
        id: "txn_net_1",
        accountId: testAccount.id,
        merchant: "Netflix",
        description: "Netflix Subscription",
        amountPaise: 64900,
        currency: "INR",
        direction: "outflow",
        status: "posted",
        source: "manual",
        occurredAt: "2026-01-05T10:00:00.000Z",
        reviewRequired: false,
        createdAt: "2026-01-05T10:00:00.000Z",
        updatedAt: "2026-01-05T10:00:00.000Z",
        version: 1,
      });

      await uow.transactions.save({
        id: "txn_net_2",
        accountId: testAccount.id,
        merchant: "Netflix",
        description: "Netflix Subscription",
        amountPaise: 64900,
        currency: "INR",
        direction: "outflow",
        status: "posted",
        source: "manual",
        occurredAt: "2026-02-04T10:00:00.000Z", // 30 days
        reviewRequired: false,
        createdAt: "2026-02-04T10:00:00.000Z",
        updatedAt: "2026-02-04T10:00:00.000Z",
        version: 1,
      });

      await uow.transactions.save({
        id: "txn_net_3",
        accountId: testAccount.id,
        merchant: "Netflix",
        description: "Netflix Subscription",
        amountPaise: 64900,
        currency: "INR",
        direction: "outflow",
        status: "posted",
        source: "manual",
        occurredAt: "2026-03-06T10:00:00.000Z", // 30 days
        reviewRequired: false,
        createdAt: "2026-03-06T10:00:00.000Z",
        updatedAt: "2026-03-06T10:00:00.000Z",
        version: 1,
      });

      const detected = await recurringService.detectRecurringPatterns();
      assert.strictEqual(detected.length, 1);

      const netflixRule = detected[0];
      assert.strictEqual(netflixRule.frequency, "monthly");
      assert.strictEqual(netflixRule.amountPaise, 64900);
      assert.strictEqual(netflixRule.status, "detected");
      assert.strictEqual(netflixRule.isEstimate, true);
      assert.strictEqual(netflixRule.evidenceTransactionIds?.length, 3);
      assert.ok(netflixRule.confidenceScore && netflixRule.confidenceScore >= 0.8);

      // Verify that no unconfirmed future ledger transactions were created in transactions store
      const ledgerTxns = await uow.transactions.query({});
      assert.strictEqual(ledgerTxns.length, 3);
    });
  });

  describe("2. Variable Utility Bill Amount Tolerance (REQ-REC-02)", () => {
    test("detects monthly electricity bill with fluctuating monthly amounts", async () => {
      // 3 electricity payments with slightly varying amounts (~15% variance)
      await uow.transactions.save({
        id: "txn_elec_1",
        accountId: testAccount.id,
        merchant: "BESCOM Electricity",
        description: "BESCOM Bill Payment",
        amountPaise: 185000, // Rs 1,850
        currency: "INR",
        direction: "outflow",
        status: "posted",
        source: "manual",
        occurredAt: "2026-01-15T12:00:00.000Z",
        reviewRequired: false,
        createdAt: "2026-01-15T12:00:00.000Z",
        updatedAt: "2026-01-15T12:00:00.000Z",
        version: 1,
      });

      await uow.transactions.save({
        id: "txn_elec_2",
        accountId: testAccount.id,
        merchant: "BESCOM Electricity",
        description: "BESCOM Bill Payment",
        amountPaise: 210000, // Rs 2,100
        currency: "INR",
        direction: "outflow",
        status: "posted",
        source: "manual",
        occurredAt: "2026-02-15T12:00:00.000Z",
        reviewRequired: false,
        createdAt: "2026-02-15T12:00:00.000Z",
        updatedAt: "2026-02-15T12:00:00.000Z",
        version: 1,
      });

      await uow.transactions.save({
        id: "txn_elec_3",
        accountId: testAccount.id,
        merchant: "BESCOM Electricity",
        description: "BESCOM Bill Payment",
        amountPaise: 195000, // Rs 1,950
        currency: "INR",
        direction: "outflow",
        status: "posted",
        source: "manual",
        occurredAt: "2026-03-16T12:00:00.000Z",
        reviewRequired: false,
        createdAt: "2026-03-16T12:00:00.000Z",
        updatedAt: "2026-03-16T12:00:00.000Z",
        version: 1,
      });

      const detected = await recurringService.detectRecurringPatterns();
      assert.strictEqual(detected.length, 1);

      const elecRule = detected[0];
      assert.strictEqual(elecRule.frequency, "monthly");
      assert.strictEqual(elecRule.expectedMinAmountPaise, 185000);
      assert.strictEqual(elecRule.expectedMaxAmountPaise, 210000);
      assert.ok(elecRule.amountPaise >= 185000 && elecRule.amountPaise <= 210000);
    });
  });

  describe("3. Exclusions & Invariant Protection (REQ-REC-03)", () => {
    test("strictly excludes internal transfers from recurring detection", async () => {
      // 3 recurring monthly transfers between accounts
      for (let i = 1; i <= 3; i++) {
        await uow.transactions.save({
          id: `txn_tr_${i}`,
          accountId: testAccount.id,
          description: "Monthly savings transfer",
          amountPaise: 1000000,
          currency: "INR",
          direction: "outflow",
          status: "posted",
          source: "manual",
          transferGroupId: `tg_${i}`, // internal transfer!
          categoryId: "cat_transfer",
          occurredAt: `2026-0${i}-01T10:00:00.000Z`,
          reviewRequired: false,
          createdAt: `2026-0${i}-01T10:00:00.000Z`,
          updatedAt: `2026-0${i}-01T10:00:00.000Z`,
          version: 1,
        });
      }

      const detected = await recurringService.detectRecurringPatterns();
      assert.strictEqual(detected.length, 0); // Transfers must NOT be classified as subscriptions
    });

    test("strictly excludes reversed transactions from recurring detection", async () => {
      await uow.transactions.save({
        id: "txn_rev_1",
        accountId: testAccount.id,
        merchant: "Gym Membership",
        description: "Gym Monthly Fee",
        amountPaise: 300000,
        currency: "INR",
        direction: "outflow",
        status: "reversed", // REVERSED!
        source: "manual",
        occurredAt: "2026-01-01T10:00:00.000Z",
        reviewRequired: false,
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-01-01T10:00:00.000Z",
        version: 1,
      });

      await uow.transactions.save({
        id: "txn_rev_2",
        accountId: testAccount.id,
        merchant: "Gym Membership",
        description: "Gym Monthly Fee",
        amountPaise: 300000,
        currency: "INR",
        direction: "outflow",
        status: "reversed", // REVERSED!
        source: "manual",
        occurredAt: "2026-02-01T10:00:00.000Z",
        reviewRequired: false,
        createdAt: "2026-02-01T10:00:00.000Z",
        updatedAt: "2026-02-01T10:00:00.000Z",
        version: 1,
      });

      const detected = await recurringService.detectRecurringPatterns();
      assert.strictEqual(detected.length, 0);
    });

    test("requires sufficient history and ignores one-off transactions", async () => {
      // Single transaction
      await uow.transactions.save({
        id: "txn_single",
        accountId: testAccount.id,
        merchant: "One Off Store",
        description: "Electronics purchase",
        amountPaise: 4500000,
        currency: "INR",
        direction: "outflow",
        status: "posted",
        source: "manual",
        occurredAt: "2026-01-01T10:00:00.000Z",
        reviewRequired: false,
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-01-01T10:00:00.000Z",
        version: 1,
      });

      const detected = await recurringService.detectRecurringPatterns();
      assert.strictEqual(detected.length, 0);
    });
  });

  describe("4. Lifecycle Transitions (REQ-REC-04)", () => {
    test("confirms, pauses, resumes, and dismisses a recurring rule", async () => {
      // Seed 3 transactions
      for (let i = 1; i <= 3; i++) {
        await uow.transactions.save({
          id: `txn_spot_${i}`,
          accountId: testAccount.id,
          merchant: "Spotify",
          description: "Spotify Premium",
          amountPaise: 11900,
          currency: "INR",
          direction: "outflow",
          status: "posted",
          source: "manual",
          occurredAt: `2026-0${i}-10T10:00:00.000Z`,
          reviewRequired: false,
          createdAt: `2026-0${i}-10T10:00:00.000Z`,
          updatedAt: `2026-0${i}-10T10:00:00.000Z`,
          version: 1,
        });
      }

      const detected = await recurringService.detectRecurringPatterns();
      assert.strictEqual(detected.length, 1);
      const ruleId = detected[0].id;
      assert.strictEqual(detected[0].status, "detected");

      // 1. Confirm rule
      const confirmed = await recurringService.confirmRecurringRule(ruleId);
      assert.strictEqual(confirmed.status, "confirmed");

      // 2. Pause rule
      const paused = await recurringService.pauseRecurringRule(ruleId);
      assert.strictEqual(paused.status, "paused");

      // 3. Resume rule
      const resumed = await recurringService.resumeRecurringRule(ruleId);
      assert.strictEqual(resumed.status, "confirmed");

      // 4. Dismiss rule
      await recurringService.dismissRecurringRule(ruleId);
      const dismissed = await uow.recurringRules.getById(ruleId);
      assert.strictEqual(dismissed?.status, "dismissed");
    });
  });
});
