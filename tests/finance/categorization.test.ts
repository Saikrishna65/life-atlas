/**
 * Life Atlas Finance: Smart Categorization Engine Automated Test Suite (Phase 3)
 * 
 * Validates deterministic local classification, merchant normalization,
 * rule priority resolution, accounting direction compatibility, and user correction learning.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  deleteFinanceDB,
  IndexedDBUnitOfWork,
  CategorizationService,
  normalizeMerchant,
  Transaction,
  FinanceError,
} from "@/lib/finance";

describe("Life Atlas Finance: Smart Categorization Engine", () => {
  let uow: IndexedDBUnitOfWork;
  let service: CategorizationService;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    service = new CategorizationService(uow);
    await uow.categories.seedDefaults();
    await uow.categorizationRules.seedDefaults();
  });

  afterEach(async () => {
    await deleteFinanceDB();
  });

  describe("1. Merchant & Narration Normalization (REQ-CAT-01)", () => {
    test("strips banking prefixes (UPI, POS, NEFT, RTGS, IMPS)", () => {
      assert.strictEqual(normalizeMerchant("UPI/SWIGGY/12345/bangalore"), "swiggy bangalore");
      assert.strictEqual(normalizeMerchant("POS 4821 ZOMATO RESTAURANT MUMBAI"), "zomato restaurant mumbai");
      assert.strictEqual(normalizeMerchant("NEFT-SALARY-ACME-CORP-OCT"), "salary acme corp oct");
      assert.strictEqual(normalizeMerchant("IMPS/P2A/98765/ZEPTO"), "zepto");
    });

    test("strips UPI handles (@okicici, @paytm, @oksbi, @ybl)", () => {
      assert.strictEqual(normalizeMerchant("swiggy@icici"), "swiggy");
      assert.strictEqual(normalizeMerchant("blinkit@axisbank payment"), "blinkit payment");
      assert.strictEqual(normalizeMerchant("merchant@paytm"), "merchant");
    });

    test("strips transaction references and account suffixes", () => {
      assert.strictEqual(normalizeMerchant("UBER INDIA RRN: 9876543210"), "uber india");
      assert.strictEqual(normalizeMerchant("NETFLIX.COM REF 123456 XX4321"), "netflix com");
    });

    test("handles empty and malformed input safely", () => {
      assert.strictEqual(normalizeMerchant(""), "");
      assert.strictEqual(normalizeMerchant("   "), "");
      assert.strictEqual(normalizeMerchant("---"), "");
    });
  });

  describe("2. Deterministic Rule Matching & Categorization (REQ-CAT-02)", () => {
    test("correctly matches Swiggy outflow to Food & Dining", async () => {
      const sugg = await service.suggestCategory({
        merchant: "Swiggy Bangalore",
        description: "UPI/swiggy@icici/4321",
        direction: "outflow",
        amountPaise: 45000,
      });

      assert.ok(sugg);
      assert.strictEqual(sugg.categoryId, "cat_food_dining");
      assert.strictEqual(sugg.categoryName, "Food & Dining");
      assert.strictEqual(sugg.ruleMatched, "Swiggy");
      assert.ok(sugg.confidence >= 0.8);
    });

    test("correctly matches Zepto and Blinkit to Groceries", async () => {
      const suggZepto = await service.suggestCategory({
        merchant: "Zepto Quick Delivery",
        direction: "outflow",
        amountPaise: 29900,
      });
      assert.ok(suggZepto);
      assert.strictEqual(suggZepto.categoryId, "cat_groceries");

      const suggBlinkit = await service.suggestCategory({
        description: "POS BLINKIT COMMERCE GURGAON",
        direction: "outflow",
        amountPaise: 54000,
      });
      assert.ok(suggBlinkit);
      assert.strictEqual(suggBlinkit.categoryId, "cat_groceries");
    });

    test("correctly matches Netflix and Spotify to Entertainment", async () => {
      const suggNetflix = await service.suggestCategory({
        merchant: "Netflix India",
        description: "E-MANDATE NETFLIX DIGITAL",
        direction: "outflow",
        amountPaise: 64900,
      });
      assert.ok(suggNetflix);
      assert.strictEqual(suggNetflix.categoryId, "cat_entertainment");

      const suggSpotify = await service.suggestCategory({
        merchant: "Spotify AB",
        direction: "outflow",
        amountPaise: 11900,
      });
      assert.ok(suggSpotify);
      assert.strictEqual(suggSpotify.categoryId, "cat_entertainment");
    });

    test("correctly matches Salary credit to Salary & Wages income", async () => {
      const sugg = await service.suggestCategory({
        description: "ACH/SALARY CREDIT/INFOSYS LTD",
        direction: "inflow",
        amountPaise: 15000000,
      });
      assert.ok(sugg);
      assert.strictEqual(sugg.categoryId, "cat_salary");
      assert.strictEqual(sugg.categoryName, "Salary & Wages");
    });
  });

  describe("3. Accounting Invariant Enforcement (REQ-CAT-03)", () => {
    test("rejects income categories for outflow expenses", async () => {
      // Even if description has 'salary', an outflow direction must never suggest Salary income!
      const sugg = await service.suggestCategory({
        description: "Salary advance return",
        direction: "outflow",
        amountPaise: 200000,
      });

      // cat_salary is type="income", so suggestCategory must reject it for outflow
      if (sugg) {
        assert.notStrictEqual(sugg.categoryId, "cat_salary");
      }
    });

    test("rejects expense categories for inflow credits", async () => {
      // An inflow credit describing 'swiggy refund' must not be classified as food expense
      const sugg = await service.suggestCategory({
        merchant: "Swiggy",
        description: "Swiggy refund for canceled order",
        direction: "inflow",
        amountPaise: 35000,
      });

      // cat_food_dining is type="expense", so suggestCategory must skip it for inflow
      if (sugg) {
        assert.notStrictEqual(sugg.categoryId, "cat_food_dining");
      }
    });
  });

  describe("4. User Corrections & Learning (REQ-CAT-04)", () => {
    test("creates custom user rule with priority over default system rules", async () => {
      const sampleTxn: Transaction = {
        id: "txn_learn_1",
        accountId: "acc_test",
        description: "POS CAFE COFFEE DAY INDIRANAGAR",
        merchant: "Cafe Coffee Day",
        amountPaise: 25000,
        currency: "INR",
        direction: "outflow",
        status: "posted",
        source: "manual",
        occurredAt: new Date().toISOString(),
        reviewRequired: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };

      const userRule = await service.learnUserCorrection(sampleTxn, "cat_food_dining");
      assert.ok(userRule);
      assert.strictEqual(userRule.isSystem, false);
      assert.strictEqual(userRule.priority, 5); // higher priority than system rules (10-30)

      // Verify that future matching uses this custom rule
      const futureSugg = await service.suggestCategory({
        merchant: "Cafe Coffee Day",
        direction: "outflow",
        amountPaise: 30000,
      });
      assert.ok(futureSugg);
      assert.strictEqual(futureSugg.categoryId, "cat_food_dining");
    });

    test("rejects learning rule if category direction contradicts transaction direction", async () => {
      const sampleTxn: Transaction = {
        id: "txn_learn_2",
        accountId: "acc_test",
        description: "Payment to Vendor",
        amountPaise: 25000,
        currency: "INR",
        direction: "outflow",
        status: "posted",
        source: "manual",
        occurredAt: new Date().toISOString(),
        reviewRequired: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };

      // Trying to assign an income category (cat_salary) to an outflow transaction
      await assert.rejects(
        async () => {
          await service.learnUserCorrection(sampleTxn, "cat_salary");
        },
        { name: "FinanceError" }
      );
    });
  });

  describe("5. Rule Lifecycle & Batch Application (REQ-CAT-05)", () => {
    test("deactivates and reactivates a categorization rule", async () => {
      const rules = await service.getAllRules();
      const swiggyRule = rules.find((r) => r.pattern === "swiggy");
      assert.ok(swiggyRule);

      // Deactivate Swiggy rule
      await service.toggleRuleActive(swiggyRule.id, false);

      // Suggestion should now be null (since rule is inactive)
      const suggInactive = await service.suggestCategory({
        merchant: "Swiggy",
        direction: "outflow",
        amountPaise: 50000,
      });
      assert.strictEqual(suggInactive, null);

      // Reactivate
      await service.toggleRuleActive(swiggyRule.id, true);
      const suggActive = await service.suggestCategory({
        merchant: "Swiggy",
        direction: "outflow",
        amountPaise: 50000,
      });
      assert.ok(suggActive);
      assert.strictEqual(suggActive.categoryId, "cat_food_dining");
    });

    test("prevents deletion of default system rules", async () => {
      const rules = await service.getAllRules();
      const systemRule = rules.find((r) => r.isSystem);
      assert.ok(systemRule);

      await assert.rejects(
        async () => {
          await service.deleteRule(systemRule.id);
        },
        { name: "FinanceError" }
      );
    });
  });
});
