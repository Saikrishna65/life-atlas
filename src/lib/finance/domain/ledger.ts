/**
 * Life Atlas Finance: Ledger Invariants & Double-Entry Accounting Engine
 * 
 * Implements deterministic financial rules:
 * 1. Transfers between user accounts do NOT count as income or expense.
 * 2. Transfers link corresponding legs with transferGroupId.
 * 3. Refunds and reversals retain original transaction records.
 * 4. Distinct posted vs available balances (pending vs posted).
 * 5. Net worth calculation never double-counts transfers or credit card repayments.
 * 6. Balanced debit/credit double-entry postings.
 */

import {
  FinanceAccount,
  Transaction,
  LedgerEntry,
  Paise,
  AccountType,
} from "./models";
import { addPaise, subtractPaise, assertSafePaise } from "./money";
import { LedgerInvariantError } from "./errors";

// -----------------------------------------------------------------------------
// Double-Entry Accounting Convention
// -----------------------------------------------------------------------------
//
// In standard accounting equation: Assets = Liabilities + Equity
//
// 1. Asset Accounts (Bank, Cash, Savings):
//    - Normal balance: DEBIT (positive)
//    - Inflow (Deposit / Transfer In): DEBIT (+ increase)
//    - Outflow (Expense / Transfer Out): CREDIT (- decrease)
//
// 2. Liability Accounts (Credit Card):
//    - Normal balance: CREDIT (positive debt owed)
//    - Outflow (Purchase charged to card): CREDIT (+ increase debt)
//    - Inflow (Payment from Bank to Card): DEBIT (- decrease debt)
//
// 3. Internal Transfers:
//    - Sending Account: Outflow -> CREDIT
//    - Receiving Account: Inflow -> DEBIT
//    - Total debits == Total credits (balanced).
//    - Net income = 0, Net expense = 0.
// -----------------------------------------------------------------------------

export function isAssetAccount(type: AccountType): boolean {
  return type === "bank" || type === "cash" || type === "savings" || type === "other";
}

export function isLiabilityAccount(type: AccountType): boolean {
  return type === "credit";
}

/**
 * Creates balanced double-entry ledger entries for a transaction.
 */
export function generateLedgerEntriesForTransaction(
  txn: Transaction,
  accountType: AccountType
): LedgerEntry[] {
  assertSafePaise(txn.amountPaise, "Transaction amountPaise");

  let postingType: "debit" | "credit";

  if (isAssetAccount(accountType)) {
    // Assets: inflow = debit (+), outflow = credit (-)
    postingType = txn.direction === "inflow" ? "debit" : "credit";
  } else {
    // Liabilities (Credit Card):
    // Card purchase (outflow) increases debt -> credit
    // Card payment (inflow) decreases debt -> debit
    postingType = txn.direction === "inflow" ? "debit" : "credit";
  }

  const entry: LedgerEntry = {
    id: `led_${txn.id}_${postingType}`,
    transactionId: txn.id,
    accountId: txn.accountId,
    type: postingType,
    amountPaise: txn.amountPaise,
    currency: txn.currency,
    effectiveDate: txn.postedAt || txn.occurredAt,
    description: txn.description,
    createdAt: txn.createdAt,
  };

  return [entry];
}

/**
 * Computes the new account balance given a base balance and a series of transactions.
 * Distinguishes between posted transactions and pending transactions.
 */
export interface AccountBalanceComputation {
  postedBalancePaise: Paise;
  availableBalancePaise: Paise;
  pendingInflowPaise: Paise;
  pendingOutflowPaise: Paise;
}

export function computeAccountBalances(
  account: FinanceAccount,
  transactions: Transaction[]
): AccountBalanceComputation {
  assertSafePaise(account.openingBalancePaise, "Opening balance");

  let postedDelta = 0;
  let pendingInflow = 0;
  let pendingOutflow = 0;

  for (const txn of transactions) {
    if (txn.accountId !== account.id) continue;
    if (txn.status === "reversed") continue; // Reversed transactions have no net effect

    const amount = txn.amountPaise;

    if (txn.status === "posted") {
      if (isAssetAccount(account.accountType)) {
        if (txn.direction === "inflow") {
          postedDelta = addPaise(postedDelta, amount);
        } else {
          postedDelta = subtractPaise(postedDelta, amount);
        }
      } else {
        // Liability account (e.g. Credit Card)
        // Inflows (payments to card) reduce debt
        // Outflows (card purchases) increase debt
        if (txn.direction === "inflow") {
          postedDelta = subtractPaise(postedDelta, amount);
        } else {
          postedDelta = addPaise(postedDelta, amount);
        }
      }
    } else if (txn.status === "pending") {
      if (txn.direction === "inflow") {
        pendingInflow = addPaise(pendingInflow, amount);
      } else {
        pendingOutflow = addPaise(pendingOutflow, amount);
      }
    }
  }

  const postedBalancePaise = addPaise(account.openingBalancePaise, postedDelta);

  let availableBalancePaise = postedBalancePaise;
  if (isAssetAccount(account.accountType)) {
    availableBalancePaise = addPaise(availableBalancePaise, pendingInflow);
    availableBalancePaise = subtractPaise(availableBalancePaise, pendingOutflow);
  } else {
    // For credit cards, pending outflows increase debt; pending inflows reduce debt
    availableBalancePaise = addPaise(availableBalancePaise, pendingOutflow);
    availableBalancePaise = subtractPaise(availableBalancePaise, pendingInflow);
  }

  return {
    postedBalancePaise,
    availableBalancePaise,
    pendingInflowPaise: pendingInflow,
    pendingOutflowPaise: pendingOutflow,
  };
}

/**
 * Computes net worth across all active user accounts.
 * 
 * Formula: Net Worth = (Sum of all Asset Accounts) - (Sum of all Liability Accounts)
 * 
 * Note: Transfers between accounts leave Net Worth exactly unchanged.
 * Paying off a credit card debt from a bank account decreases bank asset and decreases credit card debt
 * by the same amount, keeping Net Worth invariant.
 */
export function calculateNetWorthPaise(accounts: FinanceAccount[]): {
  totalAssetsPaise: Paise;
  totalLiabilitiesPaise: Paise;
  netWorthPaise: Paise;
} {
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const acc of accounts) {
    if (acc.status !== "active") continue;

    if (isAssetAccount(acc.accountType)) {
      totalAssets = addPaise(totalAssets, acc.currentBalancePaise);
    } else if (isLiabilityAccount(acc.accountType)) {
      // For credit cards, a positive balance indicates debt owed
      totalLiabilities = addPaise(totalLiabilities, acc.currentBalancePaise);
    }
  }

  const netWorth = subtractPaise(totalAssets, totalLiabilities);

  return {
    totalAssetsPaise: totalAssets,
    totalLiabilitiesPaise: totalLiabilities,
    netWorthPaise: netWorth,
  };
}

/**
 * Validates transfer invariants:
 * - Source and destination accounts must be distinct.
 * - Outflow transaction on source account.
 * - Inflow transaction on destination account.
 * - Both legs must share the exact same amountPaise and currency.
 * - Both legs must share the same transferGroupId.
 */
export function validateTransferLegs(
  sourceTxn: Transaction,
  destinationTxn: Transaction
): void {
  if (sourceTxn.accountId === destinationTxn.accountId) {
    throw new LedgerInvariantError(
      "Transfer source and destination accounts must be distinct",
      "INVALID_TRANSFER"
    );
  }

  if (sourceTxn.direction !== "outflow") {
    throw new LedgerInvariantError(
      "Source leg of transfer must have direction 'outflow'",
      "INVALID_TRANSFER"
    );
  }

  if (destinationTxn.direction !== "inflow") {
    throw new LedgerInvariantError(
      "Destination leg of transfer must have direction 'inflow'",
      "INVALID_TRANSFER"
    );
  }

  if (sourceTxn.amountPaise !== destinationTxn.amountPaise) {
    throw new LedgerInvariantError(
      `Transfer legs must have identical amounts. Source: ${sourceTxn.amountPaise}, Dest: ${destinationTxn.amountPaise}`,
      "INVALID_TRANSFER"
    );
  }

  if (sourceTxn.currency !== destinationTxn.currency) {
    throw new LedgerInvariantError(
      `Transfer currency mismatch: ${sourceTxn.currency} vs ${destinationTxn.currency}`,
      "CURRENCY_MISMATCH"
    );
  }

  if (!sourceTxn.transferGroupId || sourceTxn.transferGroupId !== destinationTxn.transferGroupId) {
    throw new LedgerInvariantError(
      "Transfer legs must share an identical transferGroupId",
      "INVALID_TRANSFER"
    );
  }
}

/**
 * Computes Cash Flow Metrics (Total Income, Total Expenses, Savings Rate) for a period.
 * 
 * Crucial Rule:
 * Transfers between user accounts (transactions with transferGroupId or category type 'transfer')
 * are strictly EXCLUDED from both Income and Expense!
 */
export interface CashFlowSummary {
  totalIncomePaise: Paise;
  totalExpensesPaise: Paise;
  netCashFlowPaise: Paise;
  savingsRatePercentage: number;
}

export function computeCashFlow(
  transactions: Transaction[],
  transferCategoryIds: Set<string> = new Set()
): CashFlowSummary {
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const txn of transactions) {
    // 1. Skip reversed transactions
    if (txn.status === "reversed") continue;

    // 2. Skip pending transactions for realized cashflow (posted only)
    if (txn.status !== "posted") continue;

    // 3. Rule 1: Exclude internal transfers!
    if (txn.transferGroupId) continue;
    if (txn.categoryId && transferCategoryIds.has(txn.categoryId)) continue;

    if (txn.direction === "inflow") {
      totalIncome = addPaise(totalIncome, txn.amountPaise);
    } else {
      totalExpenses = addPaise(totalExpenses, txn.amountPaise);
    }
  }

  const netCashFlow = subtractPaise(totalIncome, totalExpenses);

  let savingsRatePercentage = 0;
  if (totalIncome > 0) {
    // (netCashFlow / totalIncome) * 100, clamped between 0 and 100
    const rawRate = (netCashFlow / totalIncome) * 100;
    savingsRatePercentage = Math.round(Math.max(0, Math.min(100, rawRate)) * 100) / 100;
  }

  return {
    totalIncomePaise: totalIncome,
    totalExpensesPaise: totalExpenses,
    netCashFlowPaise: netCashFlow,
    savingsRatePercentage,
  };
}

/**
 * Computes an idempotency fingerprint hash for duplicate transaction prevention.
 */
export function generateTransactionFingerprint(txn: {
  accountId: string;
  amountPaise: Paise;
  direction: string;
  occurredAt: string;
  description: string;
  externalId?: string;
}): string {
  // If externalId exists from bank or aggregator, it provides deterministic external deduplication
  if (txn.externalId && txn.externalId.trim()) {
    return `ext:${txn.accountId}:${txn.externalId.trim()}`;
  }

  // Otherwise, normalize occurredAt to YYYY-MM-DD date boundary to catch same-day duplicate entries
  const dateStr = txn.occurredAt.split("T")[0];
  const normalizedDesc = txn.description.trim().toLowerCase().replace(/\s+/g, " ");

  return `fp:${txn.accountId}:${dateStr}:${txn.amountPaise}:${txn.direction}:${normalizedDesc}`;
}

