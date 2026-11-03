import "fake-indexeddb/auto";
import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  deleteFinanceDB,
  IndexedDBUnitOfWork,
  AccountService,
  TransactionService,
  SavingsGoalService,
  FinanceError,
  formatPaise,
} from "../../src/lib/finance";

describe("Life Atlas Finance: Account-Linked Savings Pockets", () => {
  let uow: IndexedDBUnitOfWork;
  let accountService: AccountService;
  let transactionService: TransactionService;
  let savingsGoalService: SavingsGoalService;
  let bankAccountId: string;
  let cashAccountId: string;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    accountService = new AccountService(uow);
    transactionService = new TransactionService(uow);
    savingsGoalService = new SavingsGoalService(uow);
    await uow.categories.seedDefaults();

    // Create primary bank account with ₹5,000 (500000 paise)
    const bank = await accountService.createAccount({
      name: "Salary Bank",
      accountType: "bank",
      openingBalancePaise: 500000,
    });
    bankAccountId = bank.id;

    // Create cash account with ₹2,000 (200000 paise)
    const cash = await accountService.createAccount({
      name: "Cash Wallet",
      accountType: "cash",
      openingBalancePaise: 200000,
    });
    cashAccountId = cash.id;
  });

  afterEach(async () => {
    await deleteFinanceDB();
  });

  test("1. Create pocket and enforce allocation limits against available balance", async () => {
    // Initial summary: Recorded ₹5,000, Allocated ₹0, Available ₹5,000
    let summary = await savingsGoalService.getAccountPocketSummary(bankAccountId);
    assert.strictEqual(summary.recordedBalancePaise, 500000);
    assert.strictEqual(summary.totalAllocatedPaise, 0);
    assert.strictEqual(summary.availableBalancePaise, 500000);
    assert.strictEqual(summary.shortfallPaise, 0);

    // Create pocket with target ₹10,000 and initial allocation ₹800 (80000 paise)
    const pocket = await savingsGoalService.createPocket({
      name: "Rainy Day",
      linkedAccountId: bankAccountId,
      targetAmountPaise: 1000000,
      initialAllocationPaise: 80000,
      icon: "Umbrella",
      color: "#3B82F6",
      note: "First set-aside",
    });

    assert.ok(pocket.id.startsWith("pocket_"));
    assert.strictEqual(pocket.allocatedPaise, 80000);
    assert.strictEqual(pocket.currentAmountPaise, 80000);
    assert.strictEqual(pocket.history.length, 1);
    assert.strictEqual(pocket.history[0].type, "allocate");
    assert.strictEqual(pocket.history[0].amountPaise, 80000);
    assert.strictEqual(pocket.history[0].balanceAfterPaise, 80000);

    // Account summary now: Recorded ₹5,000, Allocated ₹800, Available ₹4,200
    summary = await savingsGoalService.getAccountPocketSummary(bankAccountId);
    assert.strictEqual(summary.recordedBalancePaise, 500000);
    assert.strictEqual(summary.totalAllocatedPaise, 80000);
    assert.strictEqual(summary.availableBalancePaise, 420000);
    assert.strictEqual(summary.shortfallPaise, 0);

    // Setting aside more: Add ₹1,200
    const updated = await savingsGoalService.allocateToPocket(pocket.id, 120000, "Bonus allocation");
    assert.strictEqual(updated.allocatedPaise, 200000); // ₹2,000
    assert.strictEqual(updated.history.length, 2);
    assert.strictEqual(updated.history[1].type, "allocate");

    // Attempting to allocate more than available balance (available is ₹3,000, trying ₹3,500)
    await assert.rejects(
      async () => {
        await savingsGoalService.allocateToPocket(pocket.id, 350000);
      },
      (err: unknown) => err instanceof FinanceError && err.code === "INSUFFICIENT_FUNDS"
    );

    // Bank account recorded balance and net worth remain exactly ₹5,000
    const bankAccount = await accountService.getAccount(bankAccountId);
    assert.strictEqual(bankAccount?.currentBalancePaise, 500000);
  });

  test("2. Release money from pocket back to account unallocated amount", async () => {
    const pocket = await savingsGoalService.createPocket({
      name: "Gadget Fund",
      linkedAccountId: bankAccountId,
      initialAllocationPaise: 150000, // ₹1,500
    });

    // Release ₹500 back to available balance
    const released = await savingsGoalService.releaseFromPocket(pocket.id, 50000, "Need for groceries");
    assert.strictEqual(released.allocatedPaise, 100000); // ₹1,000
    assert.strictEqual(released.history.length, 2);
    assert.strictEqual(released.history[1].type, "release");
    assert.strictEqual(released.history[1].amountPaise, 50000);
    assert.strictEqual(released.history[1].balanceAfterPaise, 100000);

    const summary = await savingsGoalService.getAccountPocketSummary(bankAccountId);
    assert.strictEqual(summary.totalAllocatedPaise, 100000);
    assert.strictEqual(summary.availableBalancePaise, 400000); // ₹4,000

    // Reject releasing more than allocated
    await assert.rejects(
      async () => {
        await savingsGoalService.releaseFromPocket(pocket.id, 200000);
      },
      (err: unknown) => err instanceof FinanceError && err.code === "INVALID_AMOUNT"
    );
  });

  test("3. Move allocations between pockets on the same account and reject cross-account moves", async () => {
    const pocketA = await savingsGoalService.createPocket({
      name: "Vacation",
      linkedAccountId: bankAccountId,
      initialAllocationPaise: 200000, // ₹2,000
    });

    const pocketB = await savingsGoalService.createPocket({
      name: "New Tires",
      linkedAccountId: bankAccountId,
      initialAllocationPaise: 50000, // ₹500
    });

    const cashPocket = await savingsGoalService.createPocket({
      name: "Weekend Outing",
      linkedAccountId: cashAccountId,
      initialAllocationPaise: 30000, // ₹300
    });

    // Move ₹600 from pocketA to pocketB
    const { source, target } = await savingsGoalService.moveAllocation(
      pocketA.id,
      pocketB.id,
      60000,
      "Prioritise tires"
    );

    assert.strictEqual(source.allocatedPaise, 140000); // ₹1,400
    assert.strictEqual(target.allocatedPaise, 110000); // ₹1,100

    assert.strictEqual(source.history.at(-1)?.type, "move_out");
    assert.strictEqual(source.history.at(-1)?.relatedPocketName, "New Tires");
    assert.strictEqual(target.history.at(-1)?.type, "move_in");
    assert.strictEqual(target.history.at(-1)?.relatedPocketName, "Vacation");

    // Total bank account allocation remains ₹2,500
    const summary = await savingsGoalService.getAccountPocketSummary(bankAccountId);
    assert.strictEqual(summary.totalAllocatedPaise, 250000);

    // Cross-account move must be strictly rejected (money must not pretend to transfer bank accounts)
    await assert.rejects(
      async () => {
        await savingsGoalService.moveAllocation(pocketA.id, cashPocket.id, 10000);
      },
      (err: unknown) => err instanceof FinanceError && err.code === "ACCOUNT_MISMATCH"
    );
  });

  test("4. Spending from pocket reduces allocation atomically and reversals restore it", async () => {
    const pocket = await savingsGoalService.createPocket({
      name: "Concert Ticket",
      linkedAccountId: bankAccountId,
      initialAllocationPaise: 150000, // ₹1,500 allocated
    });

    // Record an expense of ₹1,200 assigned to the pocket
    const txn = await transactionService.recordTransaction({
      accountId: bankAccountId,
      pocketId: pocket.id,
      amountPaise: 120000, // ₹1,200
      direction: "outflow",
      description: "Music Festival Ticket",
      source: "manual",
    });

    assert.strictEqual(txn.pocketId, pocket.id);
    assert.strictEqual(txn.pocketDeductionPaise, 120000);

    // Pocket allocation is reduced atomically to ₹300
    const updatedPocket = await uow.savingsGoals.getById(pocket.id);
    assert.strictEqual(updatedPocket?.allocatedPaise, 30000);
    assert.strictEqual(updatedPocket?.history.at(-1)?.type, "spend");
    assert.strictEqual(updatedPocket?.history.at(-1)?.amountPaise, 120000);
    assert.strictEqual(updatedPocket?.history.at(-1)?.transactionId, txn.id);

    // Account balance dropped from ₹5,000 to ₹3,800
    const account = await accountService.getAccount(bankAccountId);
    assert.strictEqual(account?.currentBalancePaise, 380000);

    // Reverse transaction: pocket allocation is restored atomically
    await transactionService.reverseTransaction(txn.id, "Event cancelled");

    const refundedPocket = await uow.savingsGoals.getById(pocket.id);
    assert.strictEqual(refundedPocket?.allocatedPaise, 150000); // Back to ₹1,500
    assert.strictEqual(refundedPocket?.history.at(-1)?.type, "refund");
    assert.strictEqual(refundedPocket?.history.at(-1)?.amountPaise, 120000);

    // Account balance restored back to ₹5,000
    const restoredAccount = await accountService.getAccount(bankAccountId);
    assert.strictEqual(restoredAccount?.currentBalancePaise, 500000);
  });

  test("5. Shortfall detection preserves allocations when balance falls below total reserved", async () => {
    // Bank has ₹5,000. Allocate ₹4,000 into a pocket
    await savingsGoalService.createPocket({
      name: "Emergency Buffer",
      linkedAccountId: bankAccountId,
      initialAllocationPaise: 400000, // ₹4,000
    });

    // Large general expense of ₹3,000 occurs (not spent from pocket)
    await transactionService.recordTransaction({
      accountId: bankAccountId,
      amountPaise: 300000, // ₹3,000
      direction: "outflow",
      description: "Car Repair",
      source: "manual",
    });

    // Bank recorded balance is now ₹2,000 (5,000 - 3,000)
    // Allocations are preserved at ₹4,000 (never silently reduced!)
    // Shortfall is ₹2,000 (4,000 - 2,000), available to spend is ₹0
    const summary = await savingsGoalService.getAccountPocketSummary(bankAccountId);
    assert.strictEqual(summary.recordedBalancePaise, 200000);
    assert.strictEqual(summary.totalAllocatedPaise, 400000);
    assert.strictEqual(summary.availableBalancePaise, 0);
    assert.strictEqual(summary.shortfallPaise, 200000); // ₹2,000 shortfall
  });

  test("6. Safe deletion requires releasing or reallocating remaining balance", async () => {
    const pocket = await savingsGoalService.createPocket({
      name: "New Phone",
      linkedAccountId: bankAccountId,
      initialAllocationPaise: 50000, // ₹500
    });

    // Attempt to delete with non-zero allocation -> must reject!
    await assert.rejects(
      async () => {
        await savingsGoalService.deletePocket(pocket.id);
      },
      (err: unknown) => err instanceof FinanceError && err.code === "POCKET_NOT_EMPTY"
    );

    // Release funds first
    await savingsGoalService.releaseFromPocket(pocket.id, 50000);

    // Now deletion succeeds
    await savingsGoalService.deletePocket(pocket.id);
    const deleted = await uow.savingsGoals.getById(pocket.id);
    assert.strictEqual(deleted, null);
  });

  test("7. Legacy goals preserve manually tracked progress without automatically reserving account funds", async () => {
    // Create legacy goal (no linked account)
    const legacy = await savingsGoalService.createGoal({
      name: "Dream Wedding",
      targetAmountPaise: 5000000, // ₹50,000
      currentAmountPaise: 1200000, // ₹12,000 legacy tracked progress
    });

    assert.strictEqual(legacy.isLegacyGoal, true);
    assert.strictEqual(legacy.legacyTrackedPaise, 1200000);
    assert.strictEqual(legacy.allocatedPaise, 0); // No account funds reserved

    // Account summary is untouched
    const summaryBefore = await savingsGoalService.getAccountPocketSummary(bankAccountId);
    assert.strictEqual(summaryBefore.totalAllocatedPaise, 0);
    assert.strictEqual(summaryBefore.availableBalancePaise, 500000);

    // User explicitly migrates by choosing an account and confirming allocation of ₹1,000
    const migrated = await savingsGoalService.migrateLegacyGoal(
      legacy.id,
      bankAccountId,
      100000, // ₹1,000 confirmed
      "Initial migration from manual tracking"
    );

    assert.strictEqual(migrated.isLegacyGoal, false);
    assert.strictEqual(migrated.linkedAccountId, bankAccountId);
    assert.strictEqual(migrated.allocatedPaise, 100000);
    assert.strictEqual(migrated.history[0].type, "legacy_import");

    // Now account reflects ₹1,000 allocated
    const summaryAfter = await savingsGoalService.getAccountPocketSummary(bankAccountId);
    assert.strictEqual(summaryAfter.totalAllocatedPaise, 100000);
    assert.strictEqual(summaryAfter.availableBalancePaise, 400000);
  });
});
