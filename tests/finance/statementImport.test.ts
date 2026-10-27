/**
 * Life Atlas Finance: Offline Bank Statement Parser & Import Engine Automated Test Suite (Phase 3)
 * 
 * Validates CSV, OFX, and QIF parsing, Indian bank format compatibility, date parsing,
 * paise precision, deduplication against existing DB transactions, intra-batch deduplication,
 * and atomic ledger commitment.
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test, { describe, beforeEach, afterEach } from "node:test";
import {
  deleteFinanceDB,
  IndexedDBUnitOfWork,
  TransactionService,
  AccountService,
  ImportService,
  parseCSVStatement,
  parseOFXStatement,
  parseQIFStatement,
  FinanceAccount,
} from "@/lib/finance";

describe("Life Atlas Finance: Bank Statement Import & Deduplication Engine", () => {
  let uow: IndexedDBUnitOfWork;
  let transactionService: TransactionService;
  let accountService: AccountService;
  let importService: ImportService;
  let testAccount: FinanceAccount;

  beforeEach(async () => {
    await deleteFinanceDB();
    uow = new IndexedDBUnitOfWork();
    transactionService = new TransactionService(uow);
    accountService = new AccountService(uow);
    importService = new ImportService(uow, transactionService);
    await uow.categories.seedDefaults();
    await uow.categorizationRules.seedDefaults();

    testAccount = await accountService.createAccount({
      name: "HDFC Primary Checking",
      accountType: "bank",
      openingBalancePaise: 5000000, // Rs 50,000.00
    });
  });

  afterEach(async () => {
    await deleteFinanceDB();
  });

  describe("1. CSV Statement Parsing & Indian Bank Formats (REQ-IMP-01)", () => {
    test("parses standard CSV with Debit and Credit columns", () => {
      const csv = `Date,Narration,Chq/Ref No,Withdrawal,Deposit,Balance
15/01/2026,UPI/SWIGGY BANGALORE,REF123456,450.00,,49550.00
18/01/2026,SALARY CREDIT INFOSYS,SAL9988,,125000.50,174550.50
20/01/2026,ZEPTO GROCERIES,REF78910,299.00,,174251.50`;

      const result = parseCSVStatement(csv);
      assert.strictEqual(result.transactions.length, 3);
      assert.strictEqual(result.parsingErrors.length, 0);

      // Row 1: Swiggy debit
      assert.strictEqual(result.transactions[0].direction, "outflow");
      assert.strictEqual(result.transactions[0].amountPaise, 45000); // 450.00 -> 45000 paise
      assert.strictEqual(result.transactions[0].occurredAt, "2026-01-15T00:00:00.000Z");

      // Row 2: Salary credit with decimal paise
      assert.strictEqual(result.transactions[1].direction, "inflow");
      assert.strictEqual(result.transactions[1].amountPaise, 12500050); // 125000.50 -> 12500050 paise
      assert.strictEqual(result.transactions[1].occurredAt, "2026-01-18T00:00:00.000Z");

      // Invariant: Closing balance column (49550.00 or 174550.50) is NEVER parsed as a transaction!
      const allAmounts = result.transactions.map((t) => t.amountPaise);
      assert.ok(!allAmounts.includes(4955000));
      assert.ok(!allAmounts.includes(17455050));
    });

    test("parses CSV with signed single Amount column", () => {
      const csv = `Date,Description,Amount
2026-02-01,Netflix Subscription,-649.00
2026-02-05,Client Consulting,15000.00`;

      const result = parseCSVStatement(csv);
      assert.strictEqual(result.transactions.length, 2);
      assert.strictEqual(result.transactions[0].direction, "outflow");
      assert.strictEqual(result.transactions[0].amountPaise, 64900);
      assert.strictEqual(result.transactions[1].direction, "inflow");
      assert.strictEqual(result.transactions[1].amountPaise, 1500000);
    });

    test("handles quoted descriptions containing commas", () => {
      const csv = `Date,Description,Withdrawal,Deposit
05-02-2026,"Uber Rides, Mumbai Airport",540.00,`;

      const result = parseCSVStatement(csv);
      assert.strictEqual(result.transactions.length, 1);
      assert.strictEqual(result.transactions[0].description, "Uber Rides, Mumbai Airport");
      assert.strictEqual(result.transactions[0].amountPaise, 54000);
    });
  });

  describe("2. OFX & QIF Parsers (REQ-IMP-02)", () => {
    test("parses OFX format with STMTTRN blocks", () => {
      const ofx = `<OFX>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260215120000</DTPOSTED>
<TRNAMT>-1250.75</TRNAMT>
<FITID>OFX_TXN_001</FITID>
<NAME>AMAZON RETAIL INDIA</NAME>
<MEMO>Electronics</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260216120000</DTPOSTED>
<TRNAMT>5000.00</TRNAMT>
<FITID>OFX_TXN_002</FITID>
<NAME>DIVIDEND CREDIT</NAME>
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

      const result = parseOFXStatement(ofx);
      assert.strictEqual(result.transactions.length, 2);
      assert.strictEqual(result.transactions[0].externalId, "OFX_TXN_001");
      assert.strictEqual(result.transactions[0].amountPaise, 125075);
      assert.strictEqual(result.transactions[0].direction, "outflow");
      assert.strictEqual(result.transactions[1].amountPaise, 500000);
      assert.strictEqual(result.transactions[1].direction, "inflow");
    });

    test("parses QIF format with carets and date records", () => {
      const qif = `!Type:Bank
D12/02/2026
T-850.00
PAPOLLO PHARMACY
MCough Syrup
^
D14/02/2026
T2500.00
PFREELANCE DESIGN
^`;

      const result = parseQIFStatement(qif);
      assert.strictEqual(result.transactions.length, 2);
      assert.strictEqual(result.transactions[0].amountPaise, 85000);
      assert.strictEqual(result.transactions[0].direction, "outflow");
      assert.strictEqual(result.transactions[1].amountPaise, 250000);
      assert.strictEqual(result.transactions[1].direction, "inflow");
    });
  });

  describe("3. Deduplication & Smart Preview (REQ-IMP-03)", () => {
    test("flags duplicate transactions against existing database records", async () => {
      // 1. Record an existing transaction in the account
      await transactionService.recordTransaction({
        accountId: testAccount.id,
        description: "Swiggy Delivery",
        amountPaise: 45000,
        direction: "outflow",
        occurredAt: "2026-02-10T00:00:00.000Z",
        externalId: "EXT_SWIGGY_101",
      });

      // 2. Prepare statement containing that exact transaction plus a new one
      const csv = `Date,Narration,Chq/Ref No,Withdrawal,Deposit
10/02/2026,Swiggy Delivery,EXT_SWIGGY_101,450.00,
12/02/2026,Blinkit Fresh,EXT_BLINK_202,620.00,`;

      const preview = await importService.previewStatement(csv, "csv", testAccount.id);

      assert.strictEqual(preview.totalParsed, 2);
      assert.strictEqual(preview.newCount, 1);
      assert.strictEqual(preview.duplicateCount, 1);

      const dupItem = preview.items.find((i) => i.externalId === "EXT_SWIGGY_101");
      assert.ok(dupItem);
      assert.strictEqual(dupItem.status, "duplicate");
      assert.strictEqual(dupItem.selectedForImport, false); // Default unselected!

      const newItem = preview.items.find((i) => i.externalId === "EXT_BLINK_202");
      assert.ok(newItem);
      assert.strictEqual(newItem.status, "new");
      assert.strictEqual(newItem.selectedForImport, true); // Default selected!
      // Verify smart category suggestion was attached
      assert.strictEqual(newItem.suggestedCategoryId, "cat_groceries");
    });

    test("flags intra-batch duplicates occurring within the same statement file", async () => {
      const csv = `Date,Narration,Chq/Ref No,Withdrawal,Deposit
15/02/2026,Coffee Day,SAME_ID,200.00,
15/02/2026,Coffee Day,SAME_ID,200.00,`;

      const preview = await importService.previewStatement(csv, "csv", testAccount.id);
      assert.strictEqual(preview.newCount, 1);
      assert.strictEqual(preview.duplicateCount, 1);
    });
  });

  describe("4. Atomic Commit & Ledger Balance Synchronization (REQ-IMP-04)", () => {
    test("commits new transactions, updates account balance, and preserves ledger integrity", async () => {
      const csv = `Date,Narration,Chq/Ref No,Withdrawal,Deposit
20/02/2026,Salary Infotech,SAL_77, ,80000.00
21/02/2026,Rent Payment,RENT_88,25000.00,`;

      const preview = await importService.previewStatement(csv, "csv", testAccount.id);
      assert.strictEqual(preview.newCount, 2);

      // Starting balance was 50,000.00 (5,000,000 paise)
      // + 80,000.00 inflow - 25,000.00 outflow = net + 55,000.00
      // Expected new balance = 105,000.00 (10,500,000 paise)
      const commitRes = await importService.commitImport(testAccount.id, preview.items);

      assert.strictEqual(commitRes.importedCount, 2);
      assert.strictEqual(commitRes.totalInflowPaise, 8000000);
      assert.strictEqual(commitRes.totalOutflowPaise, 2500000);
      assert.strictEqual(commitRes.destinationAccountBalancePaise, 10500000);

      const refreshedAcc = await accountService.getAccount(testAccount.id);
      assert.strictEqual(refreshedAcc?.currentBalancePaise, 10500000);
    });
  });
});

