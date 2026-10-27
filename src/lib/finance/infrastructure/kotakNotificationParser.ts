/**
 * Life Atlas Finance: Kotak 811 Notification Parser
 * 
 * Deterministic parser for transaction notifications received from:
 * - Kotak 811 & Mobile Banking App (com.msf.kbank.mobile)
 * - Kotak Mobile Banking (com.kotak.mbanking)
 * 
 * Strictly rejects OTPs, login alerts, promotional marketing, and balance-only inquiries.
 * Produces structured ParsedNotificationTransaction with deduplication fingerprints.
 */

import {
  RawNotificationEvent,
  ParsedNotificationTransaction,
  NotificationSourceType,
} from "../domain/notificationModels";
import { rupeesToPaise } from "../domain/money";
import { TransactionDirection, Paise } from "../domain/models";
import { normalizeMerchant } from "../application/categorizationService";

export interface ParseResult {
  success: boolean;
  transaction?: ParsedNotificationTransaction;
  rejectedReason?: string;
}

export class KotakNotificationParser {
  /**
   * Deterministically parses a raw notification event into a structured transaction.
   * Rejects non-transaction notifications (OTPs, promos, logins, etc.).
   */
  static parse(event: RawNotificationEvent): ParseResult {
    const title = (event.title || event.sender || "").trim();
    const text = (event.text || "").trim();
    const combined = `${title} ${text}`.trim();

    if (!text && !title) {
      return { success: false, rejectedReason: "Empty notification title and text" };
    }

    // 1. Identify Source Type
    const sourceType = this.determineSourceType(event.packageName);

    // 2. Reject Non-Transaction Content
    const rejection = this.checkRejectionRules(combined);
    if (rejection) {
      return { success: false, rejectedReason: rejection };
    }

    // 3. Extract Direction (Inflow vs Outflow)
    const directionResult = this.extractDirection(combined);
    if (!directionResult) {
      return {
        success: false,
        rejectedReason: "Ambiguous or missing transaction direction (neither debit nor credit found)",
      };
    }
    const { direction, isRefund } = directionResult;

    // 4. Extract Transaction Amount & Available Balance
    const amountResult = this.extractAmounts(combined);
    if (!amountResult) {
      return { success: false, rejectedReason: "Could not extract valid transaction amount" };
    }
    const { transactionAmountPaise, balanceAfterPaise } = amountResult;

    // 5. Extract Account Mask (last 4 digits)
    const accountMask = this.extractAccountMask(combined);

    // 6. Extract Reference / UTR / RRN
    const referenceNumber = this.extractReferenceNumber(combined);

    // 7. Extract Merchant / Beneficiary / Payee
    const rawMerchant = this.extractMerchant(combined, direction, isRefund);
    const merchantOrBeneficiary = this.formatMerchantName(rawMerchant);

    // 8. Occurrence Timestamp
    const occurredAt = event.postTimeIso || new Date(event.postTime || Date.now()).toISOString();
    const dateKey = occurredAt.split("T")[0];

    // 9. Compute Deduplication Fingerprint
    // If a stable reference number (UTR/RRN) exists, it is the primary deduplication key.
    // Otherwise, a composite fingerprint across account, date, amount, direction, and merchant is used.
    let normalizedFingerprint: string;
    if (referenceNumber) {
      normalizedFingerprint = `ref:kotak:${accountMask || "any"}:${referenceNumber.toUpperCase()}`;
    } else {
      normalizedFingerprint = `fp:kotak:${accountMask || "any"}:${dateKey}:${transactionAmountPaise}:${direction}:${merchantOrBeneficiary.toLowerCase()}`;
    }

    // Flag ambiguity if essential fields were inferred weakly
    const isAmbiguous = !referenceNumber && (!rawMerchant || rawMerchant === "Kotak Transaction");
    const ambiguityReason = isAmbiguous
      ? "Missing both transaction reference and clear merchant name"
      : undefined;

    const parsed: ParsedNotificationTransaction = {
      rawEventId: event.id,
      sourcePackage: event.packageName,
      sourceType,
      amountPaise: transactionAmountPaise,
      direction,
      occurredAt,
      merchantOrBeneficiary,
      accountMask,
      referenceNumber,
      balanceAfterPaise,
      rawNotificationTitle: title,
      normalizedFingerprint,
      isAmbiguous,
      ambiguityReason,
    };

    return { success: true, transaction: parsed };
  }

  private static determineSourceType(packageName: string): NotificationSourceType {
    if (packageName === "com.msf.kbank.mobile" || packageName === "com.kotak.mbanking") {
      return "kotak_app";
    }
    if (packageName === "com.truecaller") {
      return "truecaller";
    }
    return "sms";
  }

  /**
   * Enforces strict rejection of non-transaction notifications
   */
  private static checkRejectionRules(text: string): string | null {
    const lower = text.toLowerCase();

    // A. OTP / Secret Codes
    if (
      /\b(otp|one time password|verification code|secret code|do not share)\b/i.test(lower) ||
      /is your.*otp/i.test(lower)
    ) {
      return "Rejected: OTP or verification code message";
    }

    // B. Login Notices
    if (
      /\b(logged in to|login to|net banking login|new login from|mobile banking registration)\b/i.test(lower)
    ) {
      return "Rejected: Security login notification";
    }

    // C. Promotional Offers
    if (
      /\b(pre-approved|apply for loan|instant loan|cashback offer|discount of|zero paperwork|win exciting|festive offer|upgrade your card)\b/i.test(
        lower
      )
    ) {
      return "Rejected: Promotional marketing campaign";
    }

    // D. Failed / Declined Transactions
    if (
      /\b(declined|failed due to|could not be processed|transaction unsuccessful|insufficient balance|insufficient funds)\b/i.test(
        lower
      )
    ) {
      return "Rejected: Failed or declined transaction attempt";
    }

    // E. Pure Balance Inquiry (no debit or credit occurred)
    const hasMovement = /\b(debited|credited|sent|received|spent|paid|refund|transfer|transferred|withdrawn)\b/i.test(
      lower
    );
    if (!hasMovement && /\b(avl bal|available balance|bal is|balance in your)\b/i.test(lower)) {
      return "Rejected: Account balance inquiry without transaction";
    }

    // F. Bill payment reminder / Due date notice
    if (/\b(bill of rs.*is due on|due date is|pay before)\b/i.test(lower) && !hasMovement) {
      return "Rejected: Bill payment due date reminder";
    }

    return null;
  }

  /**
   * Formats and canonicalizes merchant / beneficiary names into human-readable Title Case
   */
  private static formatMerchantName(raw: string): string {
    if (!raw || !raw.trim()) return "Kotak Transaction";

    const clean = raw.trim();
    const lower = clean.toLowerCase();

    // Known popular merchants / brands in India
    if (/^amazon(\s+india|\s+pay|\s+in)?$/i.test(lower)) {
      return "Amazon";
    }
    if (/^flipkart(\s+india|\s+internet)?$/i.test(lower)) {
      return "Flipkart";
    }
    if (/^swiggy/i.test(lower)) {
      return "Swiggy";
    }
    if (/^zomato/i.test(lower)) {
      return "Zomato";
    }
    if (/^zepto/i.test(lower)) {
      return "Zepto";
    }
    if (/^uber/i.test(lower)) {
      return "Uber";
    }
    if (/^ola/i.test(lower)) {
      return "Ola";
    }

    // Strip trailing punctuation
    const unpunctuated = clean.replace(/[\.\,\-]+$/, "").trim();

    // Standard title casing
    return unpunctuated
      .split(/\s+/)
      .map((word) => {
        const wLower = word.toLowerCase();
        if (["pvt", "ltd", "corp", "inc", "llp"].includes(wLower)) {
          return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  }

  /**
   * Determines cash flow direction
   */
  private static extractDirection(text: string): { direction: TransactionDirection; isRefund: boolean } | null {
    const lower = text.toLowerCase();

    // Check refund first
    if (/\b(refund of|refund credited|cashback credited|refund received)\b/i.test(lower)) {
      return { direction: "inflow", isRefund: true };
    }

    // Inflow keywords
    const isInflow = /\b(credited|received|deposited|salary)\b/i.test(lower);

    // Outflow keywords (include "spent", "spent on", "paid", etc.)
    const isOutflow = /\b(debited|spent|sent|paid|transferred|withdrawn|purchase at)\b/i.test(lower);

    if (isInflow && !isOutflow) {
      return { direction: "inflow", isRefund: false };
    }
    if (isOutflow && !isInflow) {
      return { direction: "outflow", isRefund: false };
    }

    // If both keywords occur, disambiguate:
    if (/\b(sent|debited|spent|paid|withdrawn)\b/i.test(lower)) {
      return { direction: "outflow", isRefund: false };
    }
    if (/\b(received|credited|deposited|salary)\b/i.test(lower)) {
      return { direction: "inflow", isRefund: false };
    }

    return null;
  }

  /**
   * Distinguishes the transaction amount from any subsequent available balance
   */
  private static extractAmounts(
    text: string
  ): { transactionAmountPaise: Paise; balanceAfterPaise?: Paise } | null {
    // Look for Avl Bal or Balance after
    let mainText = text;
    let balancePaise: Paise | undefined = undefined;

    const balMatch = text.match(/(?:avl bal|available balance|bal(?:ance)?(?:\s*is)?)[:\s]+(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
    if (balMatch) {
      try {
        balancePaise = rupeesToPaise(balMatch[1]);
        // Strip balance portion so main amount matcher does not confuse it
        mainText = text.replace(balMatch[0], "");
      } catch {
        // Ignored
      }
    }

    // Matches transaction amount:
    // e.g. "Rs. 1,250.00", "Rs.550", "INR 80,000", "₹ 450.50"
    const amountRegexes = [
      /(?:sent|received|debited|credited|spent|paid|refund of|transfer of)\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
      /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:debited|credited|spent|sent|received|paid|withdrawn)/i,
      /(?:rs\.?|inr|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    ];

    for (const regex of amountRegexes) {
      const match = mainText.match(regex);
      if (match && match[1]) {
        try {
          const amtPaise = rupeesToPaise(match[1]);
          if (amtPaise > 0) {
            return {
              transactionAmountPaise: amtPaise,
              balanceAfterPaise: balancePaise,
            };
          }
        } catch {
          // Continue to next regex
        }
      }
    }

    return null;
  }

  /**
   * Extracts account last 4 digits (e.g. A/c *1234 or AC X1234)
   */
  private static extractAccountMask(text: string): string | undefined {
    const patterns = [
      /(?:a\/c|ac|account)\s*(?:no\.?)?\s*[\.\*xX]*(\d{3,4})\b/i,
      /(?:card|debit card|credit card)\s*(?:ending)?\s*[\.\*xX]*(\d{4})\b/i,
      /\b(?:ac|a\/c)\s+x+(\d{4})\b/i,
    ];

    for (const p of patterns) {
      const match = text.match(p);
      if (match && match[1]) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Extracts UPI Ref, UTR, or RRN reference numbers
   */
  private static extractReferenceNumber(text: string): string | undefined {
    const patterns = [
      /upi\s*ref(?:erence)?(?:\s*no)?[:\s]*([0-9]{12})\b/i,
      /\brrn[:\s]*([0-9]{12})\b/i,
      /\bref\s*(?:no|num)?[:\s]*([A-Za-z0-9]{6,22})\b/i,
      /\bimps\s*(?:ref)?[:\s]*([A-Za-z0-9]{8,22})\b/i,
      /\butr[:\s]*([A-Za-z0-9]{10,22})\b/i,
    ];

    for (const p of patterns) {
      const match = text.match(p);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extracts merchant, payee, or beneficiary name
   */
  private static extractMerchant(
    text: string,
    direction: TransactionDirection,
    isRefund: boolean
  ): string {
    // A. Refund from merchant
    if (isRefund) {
      const refMatch = text.match(/from\s+([A-Za-z0-9\s\.\-_&]+?)(?:\s+on|\.|\s+ref|\s+avl)/i);
      if (refMatch && refMatch[1]) {
        return refMatch[1].trim();
      }
    }

    // B. Outflow: "to <MERCHANT> on", "at <MERCHANT> on", "to VPA <VPA>"
    if (direction === "outflow") {
      const vpaMatch = text.match(/(?:to\s+vpa|for\s+vpa)\s+([A-Za-z0-9\.\-_@]+)/i);
      if (vpaMatch && vpaMatch[1]) {
        return vpaMatch[1].trim();
      }

      const toMatch = text.match(/\bto\s+([A-Za-z0-9\s\.\-_&]+?)(?:\s+on\s+\d|\s+via\s+upi|\.|\s+ref|\s+avl|\s+upi\s+ref)/i);
      if (toMatch && toMatch[1]) {
        return toMatch[1].trim();
      }

      const atMatch = text.match(/\bat\s+([A-Za-z0-9\s\.\-_&]+?)(?:\s+on\s+\d|\.|\s+ref|\s+avl)/i);
      if (atMatch && atMatch[1]) {
        return atMatch[1].trim();
      }

      const towardsMatch = text.match(/\btowards\s+([A-Za-z0-9\s\.\-_&]+?)(?:\s+to|\.|\s+rrn|\s+ref)/i);
      if (towardsMatch && towardsMatch[1]) {
        return towardsMatch[1].trim();
      }
    }

    // C. Inflow: "from <SENDER> on", "by <EMPLOYER> towards"
    if (direction === "inflow") {
      const fromMatch = text.match(/\bfrom\s+([A-Za-z0-9\s\.\-_&]+?)(?:\s+on\s+\d|\.|\s+ref|\s+avl|\s+upi\s+ref)/i);
      if (fromMatch && fromMatch[1]) {
        return fromMatch[1].trim();
      }

      const byMatch = text.match(/\bby\s+([A-Za-z0-9\s\.\-_&]+?)(?:\s+towards|\.|\s+ref|\s+on)/i);
      if (byMatch && byMatch[1]) {
        return byMatch[1].trim();
      }
    }

    return "Kotak Transaction";
  }
}
