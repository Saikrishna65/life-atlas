/**
 * Life Atlas Finance: Local-First IndexedDB Persistence & Integration Test Suite
 * 
 * Tests isolated IndexedDB engine, schema migrations, account/transaction services,
 * reversals, corrections, audit logs, and the offline sync outbox.
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
  FinanceError,
} from "@/lib/finance";

describe("Life Atlas Finance: Persistence & Application Integration", () => {
  let uow: IndexedDBUnitOfWork;
  let accountService: AccountService;
  let transactionService: TransactionService;
  let balanceService: BalanceService;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    accountService = new AccountService(uow);
    transactionService = new TransactionService(uow);
    balanceService = new BalanceService(uow);
  });

  afterEach(async () => {
    await deleteFinanceDB();
  });

  describe("1. Schema Initialization & Seeding (REQ-STO-01)", () => {
    test("seeds default system categories on database creation", async () => {
      const categories = await uow.categories.getAll();
      assert.ok(categories.length >= 10, "Should have seeded system categories");

      const food = categories.find((c) => c.name === "Food & Dining");
      assert.ok(food, "Food & Dining category should exist");
      assert.strictEqual(food.isSystem, true);
      assert.strictEqual(food.type, "expense");

      const salary = categories.find((c) => c.name === "Salary & Wages");
      assert.ok(salary, "Salary & Wages category should exist");
      assert.strictEqual(salary.type, "income");

      const transfer = categories.find((c) => c.name === "Account Transfer");
      assert.ok(transfer, "Account Transfer category should exist");
      assert.strictEqual(transfer.type, "transfer");
    });
  });

  describe("2. Account Management & Lifecycle (REQ-STO-02)", () => {
    test("creates accounts and retrieves them with active status filtering", async () => {
      const acc = await accountService.createAccount({
        name: "HDFC Primary Checking",
        accountType: "bank",
        openingBalancePaise: 2500000, // ₹25,000.00
        currency: "INR",
        metadata: { institutionName: "HDFC Bank", accountNumberLast4: "1234" },
      });

      assert.ok(acc.id.startsWith("acc_"));
      assert.strictEqual(acc.currentBalancePaise, 2500000);
      assert.strictEqual(acc.status, "active");

      const retrieved = await uow.accounts.getById(acc.id);
      assert.ok(retrieved);
      assert.strictEqual(retrieved.name, "HDFC Primary Checking");

      // Archive account
      await accountService.archiveAccount(acc.id);
      const activeAccounts = await uow.accounts.getAll("active");
      assert.strictEqual(activeAccounts.length, 0);

      const allAccounts = await uow.accounts.getAll();
      assert.strictEqual(allAccounts.length, 1);
      assert.strictEqual(allAccounts[0].status, "archived");
    });
  });

  describe("3. Transactions & Automated Balance Sync (REQ-STO-03)", () => {
    test("records transactions and recalculates account balances consistently", async () => {
      const acc = await accountService.createAccount({
        name: "SBI Salary",
        accountType: "bank",
        openingBalancePaise: 1000000, // ₹10,000.00
      });

      // 1. Income transaction (₹5,000)
      await transactionService.recordTransaction({
        accountId: acc.id,
        description: "Freelance Payment",
        amountPaise: 500000,
        direction: "inflow",
        status: "posted",
      });

      // 2. Expense transaction (₹2,500)
      await transactionService.recordTransaction({
        accountId: acc.id,
        description: "Dinner with Team",
        amountPaise: 250000,
        direction: "outflow",
        status: "posted",
      });

      // Balance: 10,000 + 5,000 - 2,500 = 12,500 (1250000 paise)
      const balances = await balanceService.getAccountBalances(acc.id);
      assert.strictEqual(balances.postedBalancePaise, 1250000);
      assert.strictEqual(balances.availableBalancePaise, 1250000);
    });

    test("filters transactions by date range and search query", async () => {
      const acc = await accountService.createAccount({
        name: "ICICI Travel Account",
        accountType: "bank",
        openingBalancePaise: 10000000,
      });

      await transactionService.recordTransaction({
        accountId: acc.id,
        description: "Flight to Manali",
        amountPaise: 450000,
        direction: "outflow",
        occurredAt: "2026-10-01T10:00:00.000Z",
      });

      await transactionService.recordTransaction({
        accountId: acc.id,
        description: "Homestay Booking in Kasol",
        amountPaise: 200000,
        direction: "outflow",
        occurredAt: "2026-10-15T12:00:00.000Z",
      });

      await transactionService.recordTransaction({
        accountId: acc.id,
        description: "Bus Ticket",
        amountPaise: 50000,
        direction: "outflow",
        occurredAt: "2026-10-25T08:00:00.000Z",
      });

      // Date range query: Oct 10 to Oct 20
      const filteredByDate = await uow.transactions.query({
        accountId: acc.id,
        startDate: "2026-10-10T00:00:00.000Z",
        endDate: "2026-10-20T23:59:59.999Z",
      });
      assert.strictEqual(filteredByDate.length, 1);
      assert.strictEqual(filteredByDate[0].description, "Homestay Booking in Kasol");

      // Search query filter
      const searchResult = await uow.transactions.query({
        accountId: acc.id,
        searchQuery: "Flight",
      });
      assert.strictEqual(searchResult.length, 1);
      assert.strictEqual(searchResult[0].description, "Flight to Manali");
    });
  });

  describe("4. Internal Transfers Execution (REQ-STO-04)", () => {
    test("creates twin linked transactions and updates both account balances", async () => {
      const source = await accountService.createAccount({
        name: "Checking",
        accountType: "bank",
        openingBalancePaise: 5000000, // ₹50,000
      });

      const dest = await accountService.createAccount({
        name: "Emergency Fund",
        accountType: "savings",
        openingBalancePaise: 1000000, // ₹10,000
      });

      const transfer = await transactionService.recordTransfer({
        sourceAccountId: source.id,
        destinationAccountId: dest.id,
        amountPaise: 1500000, // ₹15,000
        description: "Monthly Savings Allocation",
      });

      assert.ok(transfer.transferGroupId.startsWith("trf_"));
      assert.strictEqual(transfer.sourceTransaction.transferGroupId, transfer.transferGroupId);
      assert.strictEqual(transfer.destinationTransaction.transferGroupId, transfer.transferGroupId);
      assert.strictEqual(transfer.sourceTransaction.direction, "outflow");
      assert.strictEqual(transfer.destinationTransaction.direction, "inflow");

      // Verify balances
      const sourceBal = await balanceService.getAccountBalances(source.id);
      const destBal = await balanceService.getAccountBalances(dest.id);

      assert.strictEqual(sourceBal.postedBalancePaise, 3500000); // 50,000 - 15,000 = 35,000
      assert.strictEqual(destBal.postedBalancePaise, 2500000); // 10,000 + 15,000 = 25,000

      // Verify net worth invariance
      const nw = await balanceService.getNetWorth();
      assert.strictEqual(nw.netWorthPaise, 6000000); // Total remains 60,000
    });
  });

  describe("5. Reversals, Corrections & Audit Trail (REQ-STO-05)", () => {
    test("reverses a transaction without deleting it from storage", async () => {
      const acc = await accountService.createAccount({
        name: "Cash in Hand",
        accountType: "cash",
        openingBalancePaise: 500000, // ₹5,000
      });

      const txn = await transactionService.recordTransaction({
        accountId: acc.id,
        description: "Erroneous Cash Charge",
        amountPaise: 100000, // ₹1,000
        direction: "outflow",
        status: "posted",
      });

      // Balance before reversal: ₹4,000
      let bal = await balanceService.getAccountBalances(acc.id);
      assert.strictEqual(bal.postedBalancePaise, 400000);

      // Execute reversal
      await transactionService.reverseTransaction(txn.id, "Customer refund / accidental tap");

      // Verify transaction record still exists
      const storedTxn = await uow.transactions.getById(txn.id);
      assert.ok(storedTxn);
      assert.strictEqual(storedTxn.status, "reversed");
      assert.ok(storedTxn.notes?.includes("Reversed"));

      // Balance restored to ₹5,000
      bal = await balanceService.getAccountBalances(acc.id);
      assert.strictEqual(bal.postedBalancePaise, 500000);

      // Verify audit event
      const audit = await uow.audit.getByEntity("transaction", txn.id);
      assert.ok(audit.some((e) => e.action === "reverse"));
    });

    test("corrects transaction fields and records field-level audit history", async () => {
      const acc = await accountService.createAccount({
        name: "Main Account",
        accountType: "bank",
        openingBalancePaise: 1000000, // ₹10,000
      });

      const txn = await transactionService.recordTransaction({
        accountId: acc.id,
        description: "Grocery Store",
        amountPaise: 80000, // ₹800 recorded by mistake
        direction: "outflow",
      });

      // User corrects amount to ₹1,200 (120000 paise)
      await transactionService.correctTransaction(
        txn.id,
        {
          amountPaise: 120000,
          description: "Whole Foods Market",
        },
        "Corrected from paper receipt"
      );

      const corrected = await uow.transactions.getById(txn.id);
      assert.ok(corrected);
      assert.strictEqual(corrected.amountPaise, 120000);
      assert.strictEqual(corrected.description, "Whole Foods Market");
      assert.strictEqual(corrected.version, 2);

      // Balance adjusted: 10,000 - 1,200 = 8,800 (880000 paise)
      const bal = await balanceService.getAccountBalances(acc.id);
      assert.strictEqual(bal.postedBalancePaise, 880000);

      // Audit check
      const auditEvents = await uow.audit.getByEntity("transaction", txn.id);
      const correctionEvent = auditEvents.find((e) => e.action === "correct");
      assert.ok(correctionEvent);
      assert.strictEqual(correctionEvent.changes.amountPaise.oldVal, 80000);
      assert.strictEqual(correctionEvent.changes.amountPaise.newVal, 120000);
    });
  });

  describe("6. Duplicate Prevention (REQ-STO-06)", () => {
    test("rejects transactions with duplicate external IDs", async () => {
      const acc = await accountService.createAccount({
        name: "Bank Sync Account",
        accountType: "bank",
        openingBalancePaise: 5000000,
      });

      await transactionService.recordTransaction({
        accountId: acc.id,
        description: "UPI Payment to Merchant",
        amountPaise: 25000,
        direction: "outflow",
        externalId: "UPI_REF_987654321",
      });

      // Attempt second import of identical external ID
      await assert.rejects(
        async () => {
          await transactionService.recordTransaction({
            accountId: acc.id,
            description: "UPI Payment to Merchant (Duplicate)",
            amountPaise: 25000,
            direction: "outflow",
            externalId: "UPI_REF_987654321",
          });
        },
        (err: unknown) =>
          err instanceof FinanceError && err.code === "DUPLICATE_TRANSACTION"
      );
    });
  });

  describe("7. Offline Outbox & Idempotency (REQ-STO-07)", () => {
    test("enqueues outbox mutations and prevents duplicate idempotency keys", async () => {
      const op = {
        id: "out_test_1",
        entityType: "transaction" as const,
        entityId: "txn_123",
        action: "create" as const,
        payloadJson: JSON.stringify({ test: true }),
        timestamp: new Date().toISOString(),
        status: "pending" as const,
        retryCount: 0,
        idempotencyKey: "idemp_txn_123_create",
      };

      await uow.outbox.enqueue(op);
      let pending = await uow.outbox.getPending();
      assert.strictEqual(pending.length, 1);

      // Enqueue identical operation with same idempotencyKey
      await uow.outbox.enqueue(op);
      pending = await uow.outbox.getPending();
      assert.strictEqual(pending.length, 1, "Should not duplicate in outbox");

      // Mark synced and clear
      await uow.outbox.markSynced(op.id);
      pending = await uow.outbox.getPending();
      assert.strictEqual(pending.length, 0);

      await uow.outbox.clearCompleted();
    });
  });
});

