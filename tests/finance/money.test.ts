/**
 * Life Atlas Finance: Money & Integer Arithmetic Automated Test Suite
 * 
 * Validates deterministic integer paise calculations, input parsing,
 * formatting (Indian Lakhs/Crores vs standard), boundary safety, and error handling.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  rupeesToPaise,
  paiseToDecimalString,
  formatPaise,
  formatIndianNumber,
  addPaise,
  subtractPaise,
  multiplyPaise,
  dividePaise,
  comparePaise,
  isSafePaise,
  MAX_SAFE_PAISE,
  MIN_SAFE_PAISE,
  createMoney,
  assertSameCurrency,
} from "@/lib/finance/domain/money";
import { MoneyCalculationError } from "@/lib/finance/domain/errors";

describe("Life Atlas Finance: Money & Arithmetic Engine", () => {
  describe("1. Paise Parsing & Precision (REQ-MON-01)", () => {
    test("accurately parses whole rupee strings to paise", () => {
      assert.strictEqual(rupeesToPaise("100"), 10000);
      assert.strictEqual(rupeesToPaise("1"), 100);
      assert.strictEqual(rupeesToPaise("0"), 0);
    });

    test("accurately parses decimal rupee strings to paise", () => {
      assert.strictEqual(rupeesToPaise("100.50"), 10050);
      assert.strictEqual(rupeesToPaise("100.05"), 10005);
      assert.strictEqual(rupeesToPaise("0.75"), 75);
      assert.strictEqual(rupeesToPaise("0.01"), 1);
    });

    test("handles comma-separated strings and currency symbols", () => {
      assert.strictEqual(rupeesToPaise("₹1,250.50"), 125050);
      assert.strictEqual(rupeesToPaise("1,00,000.00"), 10000000);
      assert.strictEqual(rupeesToPaise("₹ 99.99"), 9999);
      assert.strictEqual(rupeesToPaise("$50.25"), 5025);
    });

    test("accurately parses numeric inputs without floating-point drift", () => {
      assert.strictEqual(rupeesToPaise(100.5), 10050);
      assert.strictEqual(rupeesToPaise(0.1 + 0.2), 30); // Classic JS 0.30000000000000004 handled safely
      assert.strictEqual(rupeesToPaise(1500), 150000);
    });

    test("handles negative rupee values", () => {
      assert.strictEqual(rupeesToPaise("-50.25"), -5025);
      assert.strictEqual(rupeesToPaise("-100"), -10000);
    });

    test("rejects fractional paise (more than 2 decimal places)", () => {
      assert.throws(
        () => rupeesToPaise("10.555"),
        (err: unknown) => err instanceof MoneyCalculationError && (err as MoneyCalculationError).code === "INVALID_AMOUNT"
      );
    });

    test("rejects invalid, empty, or non-numeric inputs", () => {
      assert.throws(() => rupeesToPaise(""), MoneyCalculationError);
      assert.throws(() => rupeesToPaise("   "), MoneyCalculationError);
      assert.throws(() => rupeesToPaise("abc"), MoneyCalculationError);
      assert.throws(() => rupeesToPaise("12.34.56"), MoneyCalculationError);
      assert.throws(() => rupeesToPaise(Number.NaN), MoneyCalculationError);
      assert.throws(() => rupeesToPaise(Number.POSITIVE_INFINITY), MoneyCalculationError);
    });
  });

  describe("2. Formatting & Localization (REQ-MON-02)", () => {
    test("formats paise into Indian Lakhs and Crores grouping", () => {
      assert.strictEqual(formatIndianNumber(123), "123");
      assert.strictEqual(formatIndianNumber(1234), "1,234");
      assert.strictEqual(formatIndianNumber(12345), "12,345");
      assert.strictEqual(formatIndianNumber(123456), "1,23,456");
      assert.strictEqual(formatIndianNumber(1234567), "12,34,567");
      assert.strictEqual(formatIndianNumber(10000000), "1,00,00,000"); // 1 Crore
    });

    test("formats complete currency strings with symbol and paise decimals", () => {
      assert.strictEqual(formatPaise(12345678), "₹1,23,456.78");
      assert.strictEqual(formatPaise(1000000000), "₹1,00,00,000.00");
      assert.strictEqual(formatPaise(50), "₹0.50");
      assert.strictEqual(formatPaise(0), "₹0.00");
    });

    test("formats negative amounts and optional signs", () => {
      assert.strictEqual(formatPaise(-5000), "-₹50.00");
      assert.strictEqual(formatPaise(5000, { showSign: true }), "+₹50.00");
      assert.strictEqual(formatPaise(5000, { hideDecimalsIfZero: true }), "₹50");
    });

    test("converts paise directly to decimal string", () => {
      assert.strictEqual(paiseToDecimalString(125050), "1250.50");
      assert.strictEqual(paiseToDecimalString(5), "0.05");
      assert.strictEqual(paiseToDecimalString(-1000), "-10.00");
    });
  });

  describe("3. Safe Arithmetic Operations & Limits (REQ-MON-03)", () => {
    test("adds and subtracts paise safely", () => {
      assert.strictEqual(addPaise(50000, 25000), 75000);
      assert.strictEqual(subtractPaise(50000, 20000), 30000);
      assert.strictEqual(subtractPaise(20000, 50000), -30000);
    });

    test("multiplies paise with deterministic rounding", () => {
      // 100 paise * 0.18 (18% GST) = 18 paise
      assert.strictEqual(multiplyPaise(100, 0.18), 18);
      // 105 paise * 0.3333 = 35 paise
      assert.strictEqual(multiplyPaise(105, 0.333333333), 35);
    });

    test("divides paise safely with deterministic rounding", () => {
      assert.strictEqual(dividePaise(10000, 3), 3333);
      assert.throws(() => dividePaise(10000, 0), MoneyCalculationError);
    });

    test("compares paise correctly", () => {
      assert.strictEqual(comparePaise(100, 200), -1);
      assert.strictEqual(comparePaise(200, 100), 1);
      assert.strictEqual(comparePaise(100, 100), 0);
    });

    test("enforces safe integer bounds", () => {
      assert.strictEqual(isSafePaise(MAX_SAFE_PAISE), true);
      assert.strictEqual(isSafePaise(MIN_SAFE_PAISE), true);
      assert.strictEqual(isSafePaise(MAX_SAFE_PAISE + 1), false);
      assert.strictEqual(isSafePaise(12.34), false); // Fractional
      assert.strictEqual(isSafePaise("100"), false); // Non-number
    });

    test("rejects currency mismatches", () => {
      const inr = createMoney(10000, "INR");
      const usd = createMoney(10000, "USD");
      assert.throws(
        () => assertSameCurrency(inr, usd),
        (err: unknown) => err instanceof MoneyCalculationError && (err as MoneyCalculationError).code === "CURRENCY_MISMATCH"
      );
    });
  });
});

