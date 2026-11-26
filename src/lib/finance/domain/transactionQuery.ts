import type { Transaction } from "./models";
import type { TransactionFilterOptions } from "../storage/interfaces";
/** Shared indexed-repository and in-memory snapshot semantics, including legacy offset timestamps. */
export function selectTransactions(
  records: Transaction[],
  filters: TransactionFilterOptions,
): Transaction[] {
  let results = [...records];

  // Apply in-memory secondary filters
  if (filters.accountIds && filters.accountIds.length > 0) {
    const set = new Set(filters.accountIds);
    results = results.filter((t) => set.has(t.accountId));
  }

  if (filters.categoryIds && filters.categoryIds.length > 0) {
    const set = new Set(filters.categoryIds);
    results = results.filter((t) => t.categoryId && set.has(t.categoryId));
  }

  if (filters.startDate) {
    const startTime = Date.parse(filters.startDate);
    results = results.filter((t) => Date.parse(t.occurredAt) >= startTime);
  }

  if (filters.endDate) {
    const endTime = Date.parse(filters.endDate);
    results = results.filter((t) => Date.parse(t.occurredAt) <= endTime);
  }

  if (filters.status) {
    results = results.filter((t) => t.status === filters.status);
  }

  if (filters.direction) {
    results = results.filter((t) => t.direction === filters.direction);
  }

  if (filters.source) {
    results = results.filter((t) => t.source === filters.source);
  }

  if (filters.minAmountPaise !== undefined) {
    results = results.filter(
      (t) => t.amountPaise >= (filters.minAmountPaise || 0),
    );
  }

  if (filters.maxAmountPaise !== undefined) {
    results = results.filter(
      (t) => t.amountPaise <= (filters.maxAmountPaise || 0),
    );
  }

  if (filters.searchQuery && filters.searchQuery.trim()) {
    const q = filters.searchQuery.trim().toLowerCase();
    results = results.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        (t.merchant && t.merchant.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q)),
    );
  }

  // Sort chronologically descending (newest first)
  results.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  // Explicit zero limits return zero records; pagination must never expand accidentally.
  if (filters.offset !== undefined || filters.limit !== undefined) {
    const offset = filters.offset ?? 0;
    const limit = filters.limit;
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0))
    )
      throw new RangeError("Invalid transaction page");
    results = results.slice(
      offset,
      limit === undefined ? undefined : offset + limit,
    );
  }
  return results;
}
