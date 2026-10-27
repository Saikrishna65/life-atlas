/**
 * Life Atlas Finance: Kotak Notification & SMS Parser Test Suite
 * 
 * Verifies deterministic extraction of transaction amount, direction,
 * merchant, reference number, account mask, and strict rejection of OTPs,
 * login alerts, promotions, and balance inquiries.
 * 
 * Uses purely synthetic, fictional examples. Never requires real banking data.
 */

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  KotakNotificationParser,
  RawNotificationEvent,
  rupeesToPaise,
} from "@/lib/finance";

describe("Kotak Notification & SMS Parser", () => {
  test("parses genuine Kotak 811 UPI debit notification from bank app", () => {
    const raw: RawNotificationEvent = {
      id: "evt_kotak_app_1",
      packageName: "com.msf.kbank.mobile",
      sender: "Kotak Bank",
      title: "Sent Rs. 450.00",
      text: "Sent Rs. 450.00 from Kotak Bank AC X1234 to SWIGGY on 27-Oct-26. UPI Ref 429182736451. Not you? Call 18602662666",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T14:30:00.000Z",
    };

    const result = KotakNotificationParser.parse(raw);
    assert.strictEqual(result.success, true);
    assert.ok(result.transaction);

    const txn = result.transaction;
    assert.strictEqual(txn.sourceType, "kotak_app");
    assert.strictEqual(txn.amountPaise, rupeesToPaise(450));
    assert.strictEqual(txn.direction, "outflow");
    assert.strictEqual(txn.merchantOrBeneficiary, "Swiggy");
    assert.strictEqual(txn.accountMask, "1234");
    assert.strictEqual(txn.referenceNumber, "429182736451");
    assert.strictEqual(txn.normalizedFingerprint, "ref:kotak:1234:429182736451");
    assert.strictEqual(txn.isAmbiguous, false);
  });

  test("parses Kotak debit SMS from Google Messages and extracts available balance", () => {
    const raw: RawNotificationEvent = {
      id: "evt_sms_1",
      packageName: "com.google.android.apps.messaging",
      sender: "VK-KOTAKB",
      title: "VK-KOTAKB",
      text: "Debited Rs. 1,250.00 from Kotak Bank A/c ...XX9876 to ZEPTO via UPI. Ref no: 429100123456 on 27-Oct-26. Avl Bal: Rs 45,200.50",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T14:32:00.000Z",
    };

    const result = KotakNotificationParser.parse(raw);
    assert.strictEqual(result.success, true);
    assert.ok(result.transaction);

    const txn = result.transaction;
    assert.strictEqual(txn.sourceType, "sms");
    assert.strictEqual(txn.amountPaise, rupeesToPaise(1250));
    assert.strictEqual(txn.direction, "outflow");
    assert.strictEqual(txn.merchantOrBeneficiary, "Zepto");
    assert.strictEqual(txn.accountMask, "9876");
    assert.strictEqual(txn.referenceNumber, "429100123456");
    assert.strictEqual(txn.balanceAfterPaise, rupeesToPaise(45200.50));
    assert.strictEqual(txn.normalizedFingerprint, "ref:kotak:9876:429100123456");
  });

  test("parses Kotak Debit Card POS/Online transaction", () => {
    const raw: RawNotificationEvent = {
      id: "evt_card_1",
      packageName: "com.google.android.apps.messaging",
      sender: "VM-KOTAKB",
      title: "VM-KOTAKB",
      text: "Rs. 2,499.00 spent on your Kotak Debit Card ending 4591 at AMAZON INDIA on 27-Oct-26. Avl Bal: Rs 32,500.00. Ref: TXN998811",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T14:35:00.000Z",
    };

    const result = KotakNotificationParser.parse(raw);
    assert.strictEqual(result.success, true);
    assert.ok(result.transaction);

    const txn = result.transaction;
    assert.strictEqual(txn.amountPaise, rupeesToPaise(2499));
    assert.strictEqual(txn.direction, "outflow");
    assert.strictEqual(txn.merchantOrBeneficiary, "Amazon");
    assert.strictEqual(txn.accountMask, "4591");
    assert.strictEqual(txn.referenceNumber, "TXN998811");
  });

  test("parses Kotak UPI credit/inflow notification", () => {
    const raw: RawNotificationEvent = {
      id: "evt_credit_1",
      packageName: "com.msf.kbank.mobile",
      sender: "Kotak Bank",
      title: "Received Rs. 3,000.00",
      text: "Received Rs. 3,000.00 in your Kotak Bank A/c ...1234 from RAHUL SHARMA on 27-Oct-26. UPI Ref 429188776655. Avl Bal: Rs 25,000.00",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T14:40:00.000Z",
    };

    const result = KotakNotificationParser.parse(raw);
    assert.strictEqual(result.success, true);
    assert.ok(result.transaction);

    const txn = result.transaction;
    assert.strictEqual(txn.amountPaise, rupeesToPaise(3000));
    assert.strictEqual(txn.direction, "inflow");
    assert.strictEqual(txn.merchantOrBeneficiary, "Rahul Sharma");
    assert.strictEqual(txn.referenceNumber, "429188776655");
  });

  test("parses Kotak Salary credit notification", () => {
    const raw: RawNotificationEvent = {
      id: "evt_salary_1",
      packageName: "com.google.android.apps.messaging",
      sender: "AD-KOTAKB",
      title: "AD-KOTAKB",
      text: "Credited Rs. 85,000.00 to Kotak Bank AC X1234 on 27-Oct-26 by TECH CORP PVT LTD towards SALARY. Ref 11223344.",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T14:42:00.000Z",
    };

    const result = KotakNotificationParser.parse(raw);
    assert.strictEqual(result.success, true);
    assert.ok(result.transaction);

    const txn = result.transaction;
    assert.strictEqual(txn.amountPaise, rupeesToPaise(85000));
    assert.strictEqual(txn.direction, "inflow");
    assert.strictEqual(txn.accountMask, "1234");
    assert.strictEqual(txn.referenceNumber, "11223344");
  });

  test("parses merchant refund notification correctly as inflow", () => {
    const raw: RawNotificationEvent = {
      id: "evt_refund_1",
      packageName: "com.google.android.apps.messaging",
      sender: "VK-KOTAKB",
      title: "VK-KOTAKB",
      text: "Refund of Rs. 350.00 credited to your Kotak Bank A/c ...1234 on 27-Oct-26 from SWIGGY. Ref: RFND7788.",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T14:45:00.000Z",
    };

    const result = KotakNotificationParser.parse(raw);
    assert.strictEqual(result.success, true);
    assert.ok(result.transaction);

    const txn = result.transaction;
    assert.strictEqual(txn.amountPaise, rupeesToPaise(350));
    assert.strictEqual(txn.direction, "inflow");
    assert.strictEqual(txn.merchantOrBeneficiary, "Swiggy");
    assert.strictEqual(txn.referenceNumber, "RFND7788");
  });

  test("parses Truecaller notification displaying Kotak SMS", () => {
    const raw: RawNotificationEvent = {
      id: "evt_truecaller_1",
      packageName: "com.truecaller",
      sender: "Kotak Mahindra Bank",
      title: "Kotak Mahindra Bank",
      text: "Debited Rs. 550.00 from Kotak Bank AC X1234 to UBER on 27-Oct-26. UPI Ref 429188990011.",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T14:50:00.000Z",
    };

    const result = KotakNotificationParser.parse(raw);
    assert.strictEqual(result.success, true);
    assert.ok(result.transaction);

    const txn = result.transaction;
    assert.strictEqual(txn.sourceType, "truecaller");
    assert.strictEqual(txn.amountPaise, rupeesToPaise(550));
    assert.strictEqual(txn.direction, "outflow");
    assert.strictEqual(txn.merchantOrBeneficiary, "Uber");
    assert.strictEqual(txn.referenceNumber, "429188990011");
  });

  test("strictly rejects OTP and authentication messages", () => {
    const otpEvent: RawNotificationEvent = {
      id: "evt_otp_1",
      packageName: "com.google.android.apps.messaging",
      sender: "VK-KOTAKB",
      title: "VK-KOTAKB",
      text: "987654 is your Kotak Net Banking OTP for transaction of Rs. 500.00 at Swiggy. Do not share with anyone.",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T14:52:00.000Z",
    };

    const result = KotakNotificationParser.parse(otpEvent);
    assert.strictEqual(result.success, false);
    assert.ok(result.rejectedReason?.includes("OTP"));
    assert.strictEqual(result.transaction, undefined);
  });

  test("strictly rejects security login alerts", () => {
    const loginEvent: RawNotificationEvent = {
      id: "evt_login_1",
      packageName: "com.msf.kbank.mobile",
      sender: "Kotak Bank",
      title: "Security Notice",
      text: "Logged in to Kotak Mobile Banking app from Pixel 8 at 14:10 on 27-Oct-26. If not you, report immediately.",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T14:53:00.000Z",
    };

    const result = KotakNotificationParser.parse(loginEvent);
    assert.strictEqual(result.success, false);
    assert.ok(result.rejectedReason?.includes("login"));
  });

  test("strictly rejects promotional and loan marketing messages", () => {
    const promoEvent: RawNotificationEvent = {
      id: "evt_promo_1",
      packageName: "com.google.android.apps.messaging",
      sender: "AD-KOTAKB",
      title: "AD-KOTAKB",
      text: "Get an instant Personal Loan up to Rs. 5,00,000 in your Kotak 811 account with zero paperwork. Apply now!",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T14:54:00.000Z",
    };

    const result = KotakNotificationParser.parse(promoEvent);
    assert.strictEqual(result.success, false);
    assert.ok(result.rejectedReason?.includes("Promotional"));
  });

  test("strictly rejects balance inquiry messages where no debit or credit occurred", () => {
    const balEvent: RawNotificationEvent = {
      id: "evt_bal_1",
      packageName: "com.google.android.apps.messaging",
      sender: "VK-KOTAKB",
      title: "VK-KOTAKB",
      text: "Available balance in Kotak A/c ...1234 is Rs. 42,500.00 as on 27-Oct-26 14:00:00.",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T14:55:00.000Z",
    };

    const result = KotakNotificationParser.parse(balEvent);
    assert.strictEqual(result.success, false);
    assert.ok(result.rejectedReason?.includes("balance inquiry"));
  });

  test("strictly rejects failed or declined transaction notifications", () => {
    const failedEvent: RawNotificationEvent = {
      id: "evt_failed_1",
      packageName: "com.msf.kbank.mobile",
      sender: "Kotak Bank",
      title: "Transaction Declined",
      text: "Transaction of Rs. 1,000 declined at Reliance Fresh due to insufficient funds.",
      postTime: Date.now(),
      postTimeIso: "2026-10-27T14:56:00.000Z",
    };

    const result = KotakNotificationParser.parse(failedEvent);
    assert.strictEqual(result.success, false);
    assert.ok(result.rejectedReason?.includes("Failed or declined"));
  });
});

