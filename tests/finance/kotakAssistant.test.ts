import "fake-indexeddb/auto";
import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  deleteFinanceDB,
  IndexedDBUnitOfWork,
  AccountService,
  TransactionService,
  CategorizationService,
  NotificationTrackingService,
  parsePaise,
} from "../../src/lib/finance";

describe("Kotak Smart Assistant: Alert Parsing & Manual Review Flow", () => {
  let uow: IndexedDBUnitOfWork;
  let accountService: AccountService;
  let transactionService: TransactionService;
  let categorizationService: CategorizationService;
  let assistant: NotificationTrackingService;
  let kotakAccountId: string;
  let cashAccountId: string;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    await uow.categories.seedDefaults();
    accountService = new AccountService(uow);
    transactionService = new TransactionService(uow);
    categorizationService = new CategorizationService(uow);
    assistant = new NotificationTrackingService(uow, transactionService, categorizationService);

    // 1. Create a Kotak 811 account
    const kotakAccount = await accountService.createAccount({
      name: "Kotak 811 Primary",
      accountType: "bank",
      currency: "INR",
      openingBalancePaise: parsePaise("10000.00"), // ₹10,000
      metadata: {
        accountNumberLast4: "1234",
        institutionName: "Kotak Mahindra Bank",
      },
    });
    kotakAccountId = kotakAccount.id;

    // 2. Create another unrelated account
    const cashAccount = await accountService.createAccount({
      name: "Cash Wallet",
      accountType: "cash",
      currency: "INR",
      openingBalancePaise: parsePaise("1000.00"),
    });
    cashAccountId = cashAccount.id;
  });

  test("parses a valid Kotak UPI debit SMS and matches Kotak account", async () => {
    const alertText =
      "Sent Rs. 380.00 from Kotak Bank AC X1234 to SWIGGY on 28/10/2026. UPI Ref 539201948123. Avl bal Rs 9620.00.";
    const result = await assistant.parseAlertText(alertText);

    assert.equal(result.success, true);
    assert.ok(result.parsed);
    assert.equal(result.parsed.amountPaise, 38000); // ₹380.00 = 38000 paise
    assert.equal(result.parsed.direction, "outflow");
    assert.equal(result.parsed.merchantOrBeneficiary.toLowerCase(), "swiggy");
    assert.equal(result.parsed.referenceNumber, "539201948123");
    assert.equal(result.parsed.accountMask, "1234");
    assert.equal(result.isDuplicate, false);
    assert.equal(result.matchedAccount?.id, kotakAccountId);
  });

  test("rejects empty or malformed alert text with a clear message", async () => {
    const emptyResult = await assistant.parseAlertText("   ");
    assert.equal(emptyResult.success, false);
    assert.ok(emptyResult.error?.includes("Please enter or paste"));

    const gibberishResult = await assistant.parseAlertText("Hello friend, how are you doing today?");
    assert.equal(gibberishResult.success, false);
    assert.ok(gibberishResult.error);
  });

  test("successfully records parsed transaction into ledger", async () => {
    const alertText =
      "Sent Rs. 420.00 from Kotak Bank AC X1234 to ZEPTO on 28/10/2026. UPI Ref 882910482103.";
    const parseResult = await assistant.parseAlertText(alertText);
    assert.equal(parseResult.success, true);
    assert.ok(parseResult.parsed);

    const recorded = await assistant.confirmParsedTransaction({
      parsed: parseResult.parsed,
      accountId: parseResult.matchedAccount?.id || kotakAccountId,
      categoryId: parseResult.suggestedCategory?.categoryId,
      description: "Zepto Groceries",
    });

    assert.ok(recorded.id);
    assert.equal(recorded.amountPaise, 42000);
    assert.equal(recorded.direction, "outflow");
    assert.equal(recorded.accountId, kotakAccountId);
    assert.equal(recorded.description, "Zepto Groceries");

    // Check balance was updated correctly: 10,000 - 420 = 9,580
    const updatedAccount = await accountService.getAccount(kotakAccountId);
    assert.equal(updatedAccount?.currentBalancePaise, parsePaise("9580.00"));
  });

  test("detects duplicate when same alert is parsed again", async () => {
    const alertText =
      "Sent Rs. 420.00 from Kotak Bank AC X1234 to ZEPTO on 28/10/2026. UPI Ref 882910482103.";
    const firstParse = await assistant.parseAlertText(alertText);
    assert.equal(firstParse.success, true);
    assert.ok(firstParse.parsed);

    // Record it once
    await assistant.confirmParsedTransaction({
      parsed: firstParse.parsed,
      accountId: kotakAccountId,
    });

    // Parse the same alert again
    const duplicateResult = await assistant.parseAlertText(alertText);
    assert.equal(duplicateResult.success, true);
    assert.equal(duplicateResult.isDuplicate, true);
    assert.ok(duplicateResult.duplicateReason?.includes("882910482103"));
  });

  test("allows user to select alternate account when no Kotak mask matches", async () => {
    // Add a second Kotak account so mask-less or unmatched mask cannot fallback to single Kotak account
    await accountService.createAccount({
      name: "Kotak Savings 2",
      accountType: "bank",
      currency: "INR",
      openingBalancePaise: parsePaise("5000.00"),
      metadata: {
        accountNumberLast4: "5678",
        institutionName: "Kotak Mahindra Bank",
      },
    });

    const alertText =
      "Sent Rs. 150.00 from Kotak Bank AC X9999 to CHAI POINT on 28/10/2026. UPI Ref 991122334455.";
    const parseResult = await assistant.parseAlertText(alertText);

    assert.equal(parseResult.success, true);
    assert.ok(parseResult.parsed);
    // Mask 9999 does not match 1234 or 5678, so no auto-match
    assert.equal(parseResult.matchedAccount, null);

    // User explicitly selects Cash Account
    const recorded = await assistant.confirmParsedTransaction({
      parsed: parseResult.parsed,
      accountId: cashAccountId,
      description: "Chai Point Morning",
    });

    assert.equal(recorded.accountId, cashAccountId);
    const updatedCash = await accountService.getAccount(cashAccountId);
    assert.equal(updatedCash?.currentBalancePaise, parsePaise("850.00")); // 1000 - 150
  });

  test("parses salary and credit inflow alerts accurately", async () => {
    const alertText =
      "Received Rs. 50,000.00 in your Kotak Bank A/c ...1234 from TECH CORP towards SALARY. Ref 102938475612.";
    const parseResult = await assistant.parseAlertText(alertText);

    assert.equal(parseResult.success, true);
    assert.ok(parseResult.parsed);
    assert.equal(parseResult.parsed.direction, "inflow");
    assert.equal(parseResult.parsed.amountPaise, 5000000); // ₹50,000
    assert.equal(parseResult.matchedAccount?.id, kotakAccountId);
  });
});
