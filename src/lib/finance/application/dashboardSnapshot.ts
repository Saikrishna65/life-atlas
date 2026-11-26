import type { IUnitOfWork } from "../storage/interfaces";
import { computeAccountBalances } from "../domain/ledger";
import { addPaise, subtractPaise } from "../domain/money";
import { selectTransactions } from "../domain/transactionQuery";
import type { Transaction } from "../domain/models";

/** Refresh-scoped only. Never persists balances/transactions outside their existing finance DB. */
export async function loadDashboardSnapshot(uow: IUnitOfWork) {
  const {
    accounts: storedAccounts,
    categories,
    transactions: storedTransactions,
    pockets,
    rules,
    pendingOutboxCount,
  } = await uow.readDashboardRecords();
  const transactions = selectTransactions(storedTransactions, {});
  const byAccount = new Map<string, Transaction[]>();
  for (const row of transactions) {
    const list = byAccount.get(row.accountId) || [];
    list.push(row);
    byAccount.set(row.accountId, list);
  }
  const accounts = storedAccounts.map((account) => ({
    ...account,
    currentBalancePaise: computeAccountBalances(
      account,
      byAccount.get(account.id) || [],
    ).postedBalancePaise,
  }));
  let spendablePaise = 0,
    pendingIncomingPaise = 0;
  for (const account of accounts.filter(
    (a) =>
      a.status === "active" &&
      a.currency === "INR" &&
      ["bank", "cash", "savings"].includes(a.accountType),
  )) {
    const balance = computeAccountBalances(
      account,
      byAccount.get(account.id) || [],
    );
    const allocated = pockets
      .filter(
        (p) => p.linkedAccountId === account.id && p.status !== "archived",
      )
      .reduce((total, p) => addPaise(total, p.allocatedPaise || 0), 0);
    spendablePaise = addPaise(
      spendablePaise,
      subtractPaise(
        subtractPaise(balance.postedBalancePaise, balance.pendingOutflowPaise),
        allocated,
      ),
    );
    pendingIncomingPaise = addPaise(
      pendingIncomingPaise,
      balance.pendingInflowPaise,
    );
  }
  const proxy = <V extends object>(object: V, overrides: Partial<V>): V =>
    new Proxy(object, {
      get(target, key) {
        if (key in overrides) return overrides[key as keyof V];
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  const read = proxy(uow, {
    accounts: proxy(uow.accounts, {
      getAll: async (status) =>
        accounts.filter(
          (a) => a.currency === "INR" && (!status || a.status === status),
        ),
      getById: async (id) => accounts.find((a) => a.id === id) || null,
    }),
    categories: proxy(uow.categories, {
      getAll: async () => categories,
      getById: async (id) => categories.find((c) => c.id === id) || null,
    }),
    transactions: proxy(uow.transactions, {
      query: async (filters) =>
        selectTransactions(
          transactions.filter((t) => t.currency === "INR"),
          filters,
        ),
    }),
    savingsGoals: proxy(uow.savingsGoals, { getAll: async () => pockets }),
    recurringRules: proxy(uow.recurringRules, {
      getAll: async (status) =>
        rules.filter((r) => !status || r.status === status),
    }),
  });
  return {
    read,
    accounts,
    categories,
    transactions,
    spendablePaise,
    pendingIncomingPaise,
    pendingOutboxCount,
  };
}
