/**
 * Life Atlas Finance: Ledger Invariants & Double-Entry Accounting Test Suite
 * 
 * Validates double-entry postings, transfer rules, cash flow calculation (transfer exclusion),
 * net worth invariants, and credit card liability mechanics.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  computeAccountBalances,
  calculateNetWorthPaise,
  validateTransferLegs,
  computeCashFlow,
  generateLedgerEntriesForTransaction,
  generateTransactionFingerprint,
} from "@/lib/finance/domain/ledger";
import { FinanceAccount, Transaction } from "@/lib/finance/domain/models";
import { LedgerInvariantError } from "@/lib/finance/domain/errors";

describe("Life Atlas Finance: Ledger Rules & Accounting Invariants", () => {
  const baseAccount: FinanceAccount = {
    id: "acc_checking",
    name: "HDFC Checking",
    accountType: "bank",
    currency: "INR",
    openingBalancePaise: 5000000, // ₹50,000.00
    openingBalanceDate: "2026-01-01T00:00:00.000Z",
    currentBalancePaise: 5000000,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
  };

  describe("1. Double-Entry Postings (REQ-LED-01)", () => {
    test("generates balanced debit and credit entries for asset accounts", () => {
      const outflowTxn: Transaction = {
        id: "txn_grocery",
        accountId: "acc_checking",
        description: "Supermarket",
        amountPaise: 120000, // ₹1,200.00
        currency: "INR",
        direction: "outflow",
        status: "posted",
        source: "manual",
        occurredAt: "2026-10-27T10:00:00.000Z",
        reviewRequired: false,
        createdAt: "2026-10-27T10:00:00.000Z",
        updatedAt: "2026-10-27T10:00:00.000Z",
        version: 1,
      };

      const entries = generateLedgerEntriesForTransaction(outflowTxn, "bank");
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0].type, "credit"); // Outflow from asset = Credit
      assert.strictEqual(entries[0].amountPaise, 120000);

      const inflowTxn: Transaction = {
        ...outflowTxn,
        id: "txn_salary",
        direction: "inflow",
      };

      const inflowEntries = generateLedgerEntriesForTransaction(inflowTxn, "bank");
      assert.strictEqual(inflowEntries[0].type, "debit"); // Inflow to asset = Debit
    });
  });

  describe("2. Balance Computations: Posted vs Pending (REQ-LED-02)", () => {
    test("computes posted and available balances for asset accounts", () => {
      const transactions: Transaction[] = [
        {
          id: "txn_1",
          accountId: "acc_checking",
          description: "Salary",
          amountPaise: 10000000, // +₹1,00,000.00 (posted)
          currency: "INR",
          direction: "inflow",
          status: "posted",
          source: "manual",
          occurredAt: "2026-10-01T00:00:00.000Z",
          reviewRequired: false,
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
          version: 1,
        },
        {
          id: "txn_2",
          accountId: "acc_checking",
          description: "Rent",
          amountPaise: 2500000, // -₹25,000.00 (posted)
          currency: "INR",
          direction: "outflow",
          status: "posted",
          source: "manual",
          occurredAt: "2026-10-02T00:00:00.000Z",
          reviewRequired: false,
          createdAt: "2026-10-02T00:00:00.000Z",
          updatedAt: "2026-10-02T00:00:00.000Z",
          version: 1,
        },
        {
          id: "txn_3",
          accountId: "acc_checking",
          description: "Pending Card Charge",
          amountPaise: 500000, // -₹5,000.00 (pending)
          currency: "INR",
          direction: "outflow",
          status: "pending",
          source: "manual",
          occurredAt: "2026-10-27T00:00:00.000Z",
          reviewRequired: false,
          createdAt: "2026-10-27T00:00:00.000Z",
          updatedAt: "2026-10-27T00:00:00.000Z",
          version: 1,
        },
        {
          id: "txn_4",
          accountId: "acc_checking",
          description: "Reversed Charge",
          amountPaise: 300000,
          currency: "INR",
          direction: "outflow",
          status: "reversed", // Ignored in balance
          source: "manual",
          occurredAt: "2026-10-15T00:00:00.000Z",
          reviewRequired: false,
          createdAt: "2026-10-15T00:00:00.000Z",
          updatedAt: "2026-10-15T00:00:00.000Z",
          version: 1,
        },
      ];

      const balances = computeAccountBalances(baseAccount, transactions);

      // Opening: 50,000 + 1,00,000 - 25,000 = 1,25,000 (12500000 paise)
      assert.strictEqual(balances.postedBalancePaise, 12500000);
      // Available: 1,25,000 - 5,000 (pending) = 1,20,000 (12000000 paise)
      assert.strictEqual(balances.availableBalancePaise, 12000000);
      assert.strictEqual(balances.pendingOutflowPaise, 500000);
      assert.strictEqual(balances.pendingInflowPaise, 0);
    });

    test("computes liability balances for credit card accounts correctly", () => {
      const creditCard: FinanceAccount = {
        ...baseAccount,
        id: "acc_cc",
        name: "Axis Bank Credit Card",
        accountType: "credit",
        openingBalancePaise: 0, // Starts with ₹0 debt
        currentBalancePaise: 0,
      };

      const transactions: Transaction[] = [
        {
          id: "txn_cc_1",
          accountId: "acc_cc",
          description: "Flight Booking",
          amountPaise: 800000, // ₹8,000 outflow charged to card -> increases liability
          currency: "INR",
          direction: "outflow",
          status: "posted",
          source: "manual",
          occurredAt: "2026-10-05T00:00:00.000Z",
          reviewRequired: false,
          createdAt: "2026-10-05T00:00:00.000Z",
          updatedAt: "2026-10-05T00:00:00.000Z",
          version: 1,
        },
        {
          id: "txn_cc_2",
          accountId: "acc_cc",
          description: "Card Payment from Bank",
          amountPaise: 500000, // ₹5,000 inflow payment to card -> reduces liability
          currency: "INR",
          direction: "inflow",
          status: "posted",
          source: "manual",
          occurredAt: "2026-10-20T00:00:00.000Z",
          reviewRequired: false,
          createdAt: "2026-10-20T00:00:00.000Z",
          updatedAt: "2026-10-20T00:00:00.000Z",
          version: 1,
        },
      ];

      const balances = computeAccountBalances(creditCard, transactions);
      // Liability = 0 + 8,000 (outflow) - 5,000 (inflow) = 3,000 debt (300000 paise)
      assert.strictEqual(balances.postedBalancePaise, 300000);
      assert.strictEqual(balances.availableBalancePaise, 300000);
    });
  });

  describe("3. Transfer Invariants & Rules (REQ-LED-03)", () => {
    test("validates identical transfer legs across different accounts", () => {
      const sourceTxn: Transaction = {
        id: "txn_out",
        accountId: "acc_source",
        description: "Transfer to Savings",
        amountPaise: 200000, // ₹2,000.00
        currency: "INR",
        direction: "outflow",
        status: "posted",
        source: "manual",
        transferGroupId: "trf_123",
        occurredAt: "2026-10-27T00:00:00.000Z",
        reviewRequired: false,
        createdAt: "2026-10-27T00:00:00.000Z",
        updatedAt: "2026-10-27T00:00:00.000Z",
        version: 1,
      };

      const destTxn: Transaction = {
        ...sourceTxn,
        id: "txn_in",
        accountId: "acc_dest",
        direction: "inflow",
      };

      assert.doesNotThrow(() => validateTransferLegs(sourceTxn, destTxn));
    });

    test("rejects transfer legs with matching account IDs or mismatched amounts", () => {
      const sourceTxn: Transaction = {
        id: "txn_out",
        accountId: "acc_source",
        description: "Self transfer",
        amountPaise: 200000,
        currency: "INR",
        direction: "outflow",
        status: "posted",
        source: "manual",
        transferGroupId: "trf_123",
        occurredAt: "2026-10-27T00:00:00.000Z",
        reviewRequired: false,
        createdAt: "2026-10-27T00:00:00.000Z",
        updatedAt: "2026-10-27T00:00:00.000Z",
        version: 1,
      };

      // Same account ID
      assert.throws(
        () => validateTransferLegs(sourceTxn, { ...sourceTxn, direction: "inflow" }),
        LedgerInvariantError
      );

      // Amount mismatch
      assert.throws(
        () =>
          validateTransferLegs(sourceTxn, {
            ...sourceTxn,
            accountId: "acc_dest",
            amountPaise: 300000,
            direction: "inflow",
          }),
        LedgerInvariantError
      );
    });
  });

  describe("4. Cash Flow & Net Worth Invariants (REQ-LED-04)", () => {
    test("strictly excludes transfers from total income and total expenses", () => {
      const txns: Transaction[] = [
        {
          id: "txn_salary",
          accountId: "acc_bank",
          description: "Monthly Salary",
          amountPaise: 5000000, // ₹50,000 Income
          currency: "INR",
          direction: "inflow",
          status: "posted",
          source: "manual",
          occurredAt: "2026-10-01T00:00:00.000Z",
          reviewRequired: false,
          createdAt: "2026-10-01T00:00:00.000Z",
          updatedAt: "2026-10-01T00:00:00.000Z",
          version: 1,
        },
        {
          id: "txn_groceries",
          accountId: "acc_bank",
          description: "Groceries",
          amountPaise: 1500000, // ₹15,000 Expense
          currency: "INR",
          direction: "outflow",
          status: "posted",
          source: "manual",
          occurredAt: "2026-10-05T00:00:00.000Z",
          reviewRequired: false,
          createdAt: "2026-10-05T00:00:00.000Z",
          updatedAt: "2026-10-05T00:00:00.000Z",
          version: 1,
        },
        // Transfer leg 1 (Bank out)
        {
          id: "txn_trf_out",
          accountId: "acc_bank",
          description: "Move to Savings",
          amountPaise: 2000000, // ₹20,000
          currency: "INR",
          direction: "outflow",
          status: "posted",
          transferGroupId: "trf_savings", // EXCLUDED
          source: "manual",
          occurredAt: "2026-10-10T00:00:00.000Z",
          reviewRequired: false,
          createdAt: "2026-10-10T00:00:00.000Z",
          updatedAt: "2026-10-10T00:00:00.000Z",
          version: 1,
        },
        // Transfer leg 2 (Savings in)
        {
          id: "txn_trf_in",
          accountId: "acc_savings",
          description: "Move to Savings",
          amountPaise: 2000000, // ₹20,000
          currency: "INR",
          direction: "inflow",
          status: "posted",
          transferGroupId: "trf_savings", // EXCLUDED
          source: "manual",
          occurredAt: "2026-10-10T00:00:00.000Z",
          reviewRequired: false,
          createdAt: "2026-10-10T00:00:00.000Z",
          updatedAt: "2026-10-10T00:00:00.000Z",
          version: 1,
        },
      ];

      const flow = computeCashFlow(txns);

      // Income = ₹50,000 (5000000 paise)
      assert.strictEqual(flow.totalIncomePaise, 5000000);
      // Expenses = ₹15,000 (1500000 paise). The 20,000 transfer is NOT an expense!
      assert.strictEqual(flow.totalExpensesPaise, 1500000);
      // Net Cash Flow = 50,000 - 15,000 = 35,000 (3500000 paise)
      assert.strictEqual(flow.netCashFlowPaise, 3500000);
      // Savings rate = (35,000 / 50,000) * 100 = 70%
      assert.strictEqual(flow.savingsRatePercentage, 70);
    });

    test("computes net worth invariant without double-counting transfers or card settlements", () => {
      const bank: FinanceAccount = {
        ...baseAccount,
        id: "acc_bank",
        currentBalancePaise: 5000000, // ₹50,000
      };

      const creditCard: FinanceAccount = {
        ...baseAccount,
        id: "acc_cc",
        accountType: "credit",
        currentBalancePaise: 1000000, // ₹10,000 owed
      };

      // Initial net worth: 50,000 (asset) - 10,000 (liability) = 40,000 (4000000 paise)
      const initialNW = calculateNetWorthPaise([bank, creditCard]);
      assert.strictEqual(initialNW.totalAssetsPaise, 5000000);
      assert.strictEqual(initialNW.totalLiabilitiesPaise, 1000000);
      assert.strictEqual(initialNW.netWorthPaise, 4000000);

      // Now user pays ₹10,000 from Bank to pay off the Credit Card completely:
      // Bank balance becomes: 50,000 - 10,000 = 40,000
      // Credit card debt becomes: 10,000 - 10,000 = 0
      const afterBank = { ...bank, currentBalancePaise: 4000000 };
      const afterCC = { ...creditCard, currentBalancePaise: 0 };

      // After settlement: 40,000 (asset) - 0 (liability) = 40,000. INVARIANT PRESERVED!
      const afterNW = calculateNetWorthPaise([afterBank, afterCC]);
      assert.strictEqual(afterNW.netWorthPaise, 4000000);
    });
  });

  describe("5. Duplicate Fingerprinting (REQ-LED-05)", () => {
    test("generates deterministic external ID fingerprint", () => {
      const fp = generateTransactionFingerprint({
        accountId: "acc_1",
        amountPaise: 50000,
        direction: "outflow",
        occurredAt: "2026-10-27T10:00:00.000Z",
        description: "Coffee Shop",
        externalId: "TXN_EXT_9999",
      });
      assert.strictEqual(fp, "ext:acc_1:TXN_EXT_9999");
    });

    test("generates composite fingerprint for duplicate matching without external ID", () => {
      const fp = generateTransactionFingerprint({
        accountId: "acc_1",
        amountPaise: 50000,
        direction: "outflow",
        occurredAt: "2026-10-27T10:30:00.000Z",
        description: "  Coffee   Shop  ",
      });
      assert.strictEqual(fp, "fp:acc_1:2026-10-27:50000:outflow:coffee shop");
    });
  });
});

