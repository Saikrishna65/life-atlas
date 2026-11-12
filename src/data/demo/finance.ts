import type { Transaction } from "./types";
const purchases: [string, string, number][] = [
  ["Neighborhood grocer", "Groceries", 246800],
  ["Local railway booking", "Transport", 184000],
  ["Riverside café", "Food", 68000],
  ["Bookshop on the corner", "Shopping", 125000],
  ["Broadband bill", "Bills", 99900],
  ["Weekend market", "Groceries", 87500],
  ["Bus and metro pass", "Transport", 150000],
  ["Lunch with friends", "Food", 142000],
  ["Walking shoes", "Shopping", 329900],
];
export const transactions: Transaction[] = Array.from(
  { length: 12 },
  (_, month) => [
    {
      id: `txn-${month * 10 + 1}`,
      date: `2025-${String(month + 1).padStart(2, "0")}-01`,
      description: "Sample monthly salary",
      category: "Income",
      amountPaise: 8500000,
      direction: "in" as const,
    },
    ...purchases.map(([description, category, amount], i) => ({
      id: `txn-${month * 10 + i + 2}`,
      date: `2025-${String(month + 1).padStart(2, "0")}-${String(3 + i * 3).padStart(2, "0")}`,
      description,
      category,
      amountPaise: amount + month * 1250,
      direction: "out" as const,
    })),
  ],
).flat();
export const openingBalancePaise = 2500000;
export function financeSummary(records = transactions) {
  const income = records
    .filter((t) => t.direction === "in")
    .reduce((n, t) => n + t.amountPaise, 0);
  const expenses = records
    .filter((t) => t.direction === "out")
    .reduce((n, t) => n + t.amountPaise, 0);
  return {
    income,
    expenses,
    closingBalancePaise: openingBalancePaise + income - expenses,
  };
}
