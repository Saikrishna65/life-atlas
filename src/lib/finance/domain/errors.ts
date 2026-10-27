/**
 * Life Atlas Finance: Domain and Storage Error Hierarchy
 */

export type FinanceErrorCode =
  | "INVALID_AMOUNT"
  | "UNSAFE_NUMERIC_CONVERSION"
  | "CURRENCY_MISMATCH"
  | "INVALID_ACCOUNT"
  | "ACCOUNT_ARCHIVED"
  | "INSUFFICIENT_FUNDS"
  | "DUPLICATE_TRANSACTION"
  | "TRANSACTION_NOT_FOUND"
  | "TRANSACTION_ALREADY_REVERSED"
  | "INVALID_TRANSFER"
  | "VALIDATION_FAILED"
  | "CONCURRENCY_CONFLICT"
  | "STORAGE_UNAVAILABLE"
  | "PERSISTENCE_FAILED"
  | "TRANSACTION_FAILED"
  | "CATEGORY_IN_USE"
  | "NOT_FOUND"
  | "INVARIANT_VIOLATION"
  | "UNSUPPORTED_FORMAT"
  | "INVALID_OPERATION";

export class FinanceError extends Error {
  readonly code: FinanceErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(message: string, code: FinanceErrorCode, details?: Record<string, unknown>) {
    super(message);
    this.name = "FinanceError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MoneyCalculationError extends FinanceError {
  constructor(message: string, code: FinanceErrorCode = "INVALID_AMOUNT", details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = "MoneyCalculationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LedgerInvariantError extends FinanceError {
  constructor(message: string, code: FinanceErrorCode = "INVALID_TRANSFER", details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = "LedgerInvariantError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class StorageError extends FinanceError {
  readonly originalError?: unknown;

  constructor(message: string, code: FinanceErrorCode = "PERSISTENCE_FAILED", originalError?: unknown) {
    super(message, code, { originalError });
    this.name = "StorageError";
    this.originalError = originalError;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
