/**
 * Life Atlas Finance: Money Calculation & Integer Arithmetic Engine
 * 
 * Strict, deterministic integer arithmetic in paise (1 INR = 100 paise).
 * Zero floating-point rounding errors. Uses strict boundary checks against Number.MAX_SAFE_INTEGER.
 */

import { MoneyCalculationError } from "./errors";
import { Paise, CurrencyCode } from "./models";

export const DEFAULT_CURRENCY: CurrencyCode = "INR";

/**
 * Maximum safe integer in paise (~90 trillion INR, well beyond any individual net worth).
 */
export const MAX_SAFE_PAISE = Number.MAX_SAFE_INTEGER;
export const MIN_SAFE_PAISE = -Number.MAX_SAFE_INTEGER;

/**
 * Validates if a value is a strictly valid integer paise amount.
 */
export function isSafePaise(value: unknown): value is Paise {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= MIN_SAFE_PAISE &&
    value <= MAX_SAFE_PAISE
  );
}

/**
 * Asserts that a value is safe integer paise, otherwise throwing MoneyCalculationError.
 */
export function assertSafePaise(value: unknown, context: string = "amount"): asserts value is Paise {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new MoneyCalculationError(
      `Invalid ${context}: Expected safe integer paise, received: ${String(value)}`,
      "INVALID_AMOUNT"
    );
  }
  if (value < MIN_SAFE_PAISE || value > MAX_SAFE_PAISE) {
    throw new MoneyCalculationError(
      `${context} exceeds safe integer bounds: ${String(value)}`,
      "UNSAFE_NUMERIC_CONVERSION"
    );
  }
}

/**
 * Parses user input or string representation into integer paise.
 * 
 * Supported formats:
 * - "1250" -> 125000 paise (1250 rupees)
 * - "1250.50" -> 125050 paise
 * - "1,250.50" -> 125050 paise
 * - "₹1,23,456.78" -> 12345678 paise
 * - 1500 (number representing rupees) -> 150000 paise
 * 
 * Rejects:
 * - More than 2 decimal places (fractional paise like "10.555")
 * - NaN, Infinity, non-numeric strings
 */
export function rupeesToPaise(input: string | number): Paise {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      throw new MoneyCalculationError("Cannot parse non-finite number as rupees", "INVALID_AMOUNT");
    }
    // Convert to fixed string with 2 decimals to avoid JS floating-point multiplication errors
    input = input.toFixed(2);
  }

  if (typeof input !== "string") {
    throw new MoneyCalculationError(`Expected string or number for rupees, received: ${typeof input}`, "INVALID_AMOUNT");
  }

  let cleaned = input.trim();
  // Strip currency symbols (₹, $, €, £) and space
  cleaned = cleaned.replace(/^[₹$€£\s]+/, "").trim();
  // Strip thousands separators (, or space)
  cleaned = cleaned.replace(/,/g, "").trim();

  if (!cleaned) {
    throw new MoneyCalculationError("Cannot parse empty amount string", "INVALID_AMOUNT");
  }

  // Handle negative sign
  let isNegative = false;
  if (cleaned.startsWith("-")) {
    isNegative = true;
    cleaned = cleaned.slice(1).trim();
  } else if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1).trim();
  }

  // Match: digits with optional decimal point and 1-2 decimal digits
  const match = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    throw new MoneyCalculationError(
      `Invalid rupee format: "${input}". Up to 2 decimal places permitted without fractional paise.`,
      "INVALID_AMOUNT"
    );
  }

  const wholeRupeesStr = match[1];
  const decimalStr = (match[2] || "").padEnd(2, "0"); // "5" -> "50", "" -> "00"

  const wholeRupees = Number.parseInt(wholeRupeesStr, 10);
  const decimalPaise = Number.parseInt(decimalStr, 10);

  if (!Number.isSafeInteger(wholeRupees)) {
    throw new MoneyCalculationError("Rupee amount exceeds maximum safe integer limits", "UNSAFE_NUMERIC_CONVERSION");
  }

  const totalPaise = wholeRupees * 100 + decimalPaise;
  const result = isNegative ? -totalPaise : totalPaise;

  assertSafePaise(result, "Parsed paise");
  return result;
}

/**
 * Convenient alias for rupeesToPaise
 */
export const parsePaise = rupeesToPaise;

/**
 * Converts integer paise directly into a standard decimal string (e.g. 125050 -> "1250.50").
 */
export function paiseToDecimalString(amountPaise: Paise): string {
  assertSafePaise(amountPaise, "Paise to decimal conversion");
  const isNegative = amountPaise < 0;
  const abs = Math.abs(amountPaise);
  const whole = Math.floor(abs / 100);
  const fractional = (abs % 100).toString().padStart(2, "0");
  return `${isNegative ? "-" : ""}${whole}.${fractional}`;
}

/**
 * Formats integer paise into localized Indian currency string (Lakhs & Crores format)
 * 
 * Example:
 * 12345678 paise -> "₹1,23,456.78"
 * 1000000000 paise -> "₹1,00,00,000.00" (1 crore)
 * -5000 paise -> "-₹50.00"
 */
export function formatPaise(
  amountPaise: Paise,
  options: {
    currency?: CurrencyCode;
    showSign?: boolean;
    useIndianFormat?: boolean;
    hideDecimalsIfZero?: boolean;
  } = {}
): string {
  assertSafePaise(amountPaise, "formatPaise amount");

  const {
    currency = DEFAULT_CURRENCY,
    showSign = false,
    useIndianFormat = true,
    hideDecimalsIfZero = false,
  } = options;

  const isNegative = amountPaise < 0;
  const absPaise = Math.abs(amountPaise);
  const wholeRupees = Math.floor(absPaise / 100);
  const fractionalPaise = absPaise % 100;

  // Format whole rupees with Indian numbering or standard 3-digit comma
  let formattedWhole: string;
  if (useIndianFormat && currency === "INR") {
    formattedWhole = formatIndianNumber(wholeRupees);
  } else {
    formattedWhole = wholeRupees.toLocaleString("en-US");
  }

  let formattedFraction = `.${fractionalPaise.toString().padStart(2, "0")}`;
  if (hideDecimalsIfZero && fractionalPaise === 0) {
    formattedFraction = "";
  }

  const symbol = getCurrencySymbol(currency);
  const sign = isNegative ? "-" : showSign && amountPaise > 0 ? "+" : "";

  return `${sign}${symbol}${formattedWhole}${formattedFraction}`;
}

/**
 * Formats a non-negative whole integer according to the Indian numbering system (2,2,3 grouping)
 * Example: 1234567 -> "12,34,567"
 */
export function formatIndianNumber(val: number): string {
  const str = Math.floor(Math.abs(val)).toString();
  if (str.length <= 3) return str;

  // Last 3 digits
  const lastThree = str.slice(-3);
  // Remaining leading digits grouped by 2
  const rest = str.slice(0, -3);

  const groupedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${groupedRest},${lastThree}`;
}

/**
 * Maps currency code to standard currency symbol
 */
export function getCurrencySymbol(currency: CurrencyCode): string {
  switch (currency.toUpperCase()) {
    case "INR":
      return "₹";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    default:
      return `${currency} `;
  }
}

// -----------------------------------------------------------------------------
// Safe Integer Arithmetic Operations (Paise)
// -----------------------------------------------------------------------------

export function addPaise(a: Paise, b: Paise): Paise {
  assertSafePaise(a, "addPaise operand a");
  assertSafePaise(b, "addPaise operand b");
  const res = a + b;
  assertSafePaise(res, "addPaise result");
  return res;
}

export function subtractPaise(a: Paise, b: Paise): Paise {
  assertSafePaise(a, "subtractPaise operand a");
  assertSafePaise(b, "subtractPaise operand b");
  const res = a - b;
  assertSafePaise(res, "subtractPaise result");
  return res;
}

/**
 * Multiplies paise by a factor (e.g. tax percentage, split ratio)
 * Rounds deterministically to nearest integer paise (half away from zero).
 */
export function multiplyPaise(amount: Paise, factor: number): Paise {
  assertSafePaise(amount, "multiplyPaise amount");
  if (!Number.isFinite(factor)) {
    throw new MoneyCalculationError("Multiplication factor must be a finite number", "INVALID_AMOUNT");
  }
  const result = Math.round(amount * factor);
  assertSafePaise(result, "multiplyPaise result");
  return result;
}

/**
 * Divides paise by an integer or floating divisor with deterministic rounding.
 */
export function dividePaise(amount: Paise, divisor: number): Paise {
  assertSafePaise(amount, "dividePaise amount");
  if (!Number.isFinite(divisor) || divisor === 0) {
    throw new MoneyCalculationError("Division by zero or non-finite divisor", "INVALID_AMOUNT");
  }
  const result = Math.round(amount / divisor);
  assertSafePaise(result, "dividePaise result");
  return result;
}

export function comparePaise(a: Paise, b: Paise): -1 | 0 | 1 {
  assertSafePaise(a, "comparePaise a");
  assertSafePaise(b, "comparePaise b");
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Represents a discrete monetary value with an explicit currency.
 */
export interface Money {
  amountPaise: Paise;
  currency: CurrencyCode;
}

export function createMoney(amountPaise: Paise, currency: CurrencyCode = DEFAULT_CURRENCY): Money {
  assertSafePaise(amountPaise, "createMoney amount");
  return { amountPaise, currency };
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyCalculationError(
      `Currency mismatch: cannot perform operation between ${a.currency} and ${b.currency}`,
      "CURRENCY_MISMATCH",
      { currencyA: a.currency, currencyB: b.currency }
    );
  }
}

