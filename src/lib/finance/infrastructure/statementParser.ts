/**
 * Life Atlas Finance: Offline Bank Statement Parser Engine
 * 
 * High-precision, zero-network parsers for CSV, OFX, and QIF formats.
 * Auto-detects major Indian bank statement layouts (HDFC, SBI, ICICI, Axis, Kotak, standard CSV).
 * Converts currency text into safe integer paise without floating-point math errors.
 */

import { NormalizedBankTransaction, StatementParseResult } from "./interfaces";
import { rupeesToPaise, DEFAULT_CURRENCY } from "../domain/money";
import { TransactionDirection } from "../domain/models";

export interface ColumnMapping {
  dateColIndex: number;
  descriptionColIndex: number;
  debitColIndex?: number;
  creditColIndex?: number;
  amountColIndex?: number;
  typeColIndex?: number; // "DR" / "CR"
  referenceColIndex?: number;
  balanceColIndex?: number;
  hasHeader: boolean;
}

/**
 * Splits CSV lines while respecting double quotes containing commas or newlines.
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parses diverse date formats into an ISO 8601 string.
 * Supports DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD/MM/YY.
 */
export function parseStatementDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const clean = dateStr.trim().replace(/[^\d\/\-\.]/g, "");

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) {
      year += 2000;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${year}-${mm}-${dd}T00:00:00.000Z`;
    }
  }

  // YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${year}-${mm}-${dd}T00:00:00.000Z`;
    }
  }

  const parsed = Date.parse(dateStr);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  return null;
}

/**
 * Heuristically detects column layout from CSV headers.
 */
export function detectCSVColumns(headers: string[]): ColumnMapping | null {
  const normHeaders = headers.map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ""));

  let dateColIndex = -1;
  let descriptionColIndex = -1;
  let debitColIndex = -1;
  let creditColIndex = -1;
  let amountColIndex = -1;
  let typeColIndex = -1;
  let referenceColIndex = -1;
  let balanceColIndex = -1;

  for (let i = 0; i < normHeaders.length; i++) {
    const h = normHeaders[i];

    if (dateColIndex === -1 && (h === "date" || h === "txndate" || h === "valuedate" || h === "transactiondate")) {
      dateColIndex = i;
    } else if (
      descriptionColIndex === -1 &&
      (h === "narration" ||
        h === "description" ||
        h === "particulars" ||
        h === "remarks" ||
        h === "details" ||
        h === "payee")
    ) {
      descriptionColIndex = i;
    } else if (debitColIndex === -1 && (h.includes("debit") || h.includes("withdrawal") || h.includes("wdr") || h === "dr") && !h.includes("credit")) {
      debitColIndex = i;
    } else if (creditColIndex === -1 && (h.includes("credit") || h.includes("deposit") || h.includes("dep") || h === "cr") && !h.includes("debit")) {
      creditColIndex = i;
    } else if (amountColIndex === -1 && (h === "amount" || h === "netamount" || h === "txnamount")) {
      amountColIndex = i;
    } else if (typeColIndex === -1 && (h === "type" || h === "drcr" || h === "crdr")) {
      typeColIndex = i;
    } else if (
      referenceColIndex === -1 &&
      (h.includes("ref") || h.includes("chq") || h.includes("cheque") || h.includes("utr") || h.includes("txnid") || h.includes("txnno"))
    ) {
      referenceColIndex = i;
    } else if (balanceColIndex === -1 && (h === "balance" || h === "closingbalance" || h === "availbalance")) {
      balanceColIndex = i;
    }
  }

  if (dateColIndex !== -1 && descriptionColIndex !== -1 && (amountColIndex !== -1 || (debitColIndex !== -1 && creditColIndex !== -1))) {
    return {
      dateColIndex,
      descriptionColIndex,
      debitColIndex: debitColIndex !== -1 ? debitColIndex : undefined,
      creditColIndex: creditColIndex !== -1 ? creditColIndex : undefined,
      amountColIndex: amountColIndex !== -1 ? amountColIndex : undefined,
      typeColIndex: typeColIndex !== -1 ? typeColIndex : undefined,
      referenceColIndex: referenceColIndex !== -1 ? referenceColIndex : undefined,
      balanceColIndex: balanceColIndex !== -1 ? balanceColIndex : undefined,
      hasHeader: true,
    };
  }

  return null;
}

/**
 * Parses bank CSV statement text into normalized transactions.
 */
export function parseCSVStatement(
  csvText: string,
  customMapping?: ColumnMapping
): StatementParseResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const errors: { line?: number; error: string }[] = [];
  const transactions: NormalizedBankTransaction[] = [];

  if (lines.length === 0) {
    return {
      transactions: [],
      parsingErrors: [{ error: "Empty CSV file content." }],
      confidenceScore: 0.0,
    };
  }

  let mapping = customMapping;
  let startLineIndex = 0;

  if (!mapping) {
    // Search top lines for header row
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const cols = parseCSVLine(lines[i]);
      const detected = detectCSVColumns(cols);
      if (detected) {
        mapping = detected;
        startLineIndex = i + 1;
        break;
      }
    }
  } else if (mapping.hasHeader) {
    startLineIndex = 1;
  }

  if (!mapping) {
    return {
      transactions: [],
      parsingErrors: [{ error: "Could not auto-detect bank statement headers. Please specify column mapping." }],
      confidenceScore: 0.0,
    };
  }

  for (let i = startLineIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    const cols = parseCSVLine(rawLine);

    if (cols.length <= Math.max(mapping.dateColIndex, mapping.descriptionColIndex)) {
      continue; // Skip malformed or trailing notes lines
    }

    const rawDate = cols[mapping.dateColIndex];
    const occurredAt = parseStatementDate(rawDate);
    if (!occurredAt) {
      continue; // Likely footer, summary, or blank line
    }

    const description = cols[mapping.descriptionColIndex]?.trim() || "Unspecified Bank Transaction";
    let direction: TransactionDirection = "outflow";
    let amountPaise = 0;

    try {
      if (mapping.debitColIndex !== undefined && mapping.creditColIndex !== undefined) {
        const rawDebit = cols[mapping.debitColIndex]?.trim();
        const rawCredit = cols[mapping.creditColIndex]?.trim();

        if (rawCredit && rawCredit !== "-" && rawCredit !== "0") {
          direction = "inflow";
          amountPaise = rupeesToPaise(rawCredit);
        } else if (rawDebit && rawDebit !== "-" && rawDebit !== "0") {
          direction = "outflow";
          amountPaise = rupeesToPaise(rawDebit);
        } else {
          continue; // Zero amount transaction
        }
      } else if (mapping.amountColIndex !== undefined) {
        const rawAmt = cols[mapping.amountColIndex]?.trim();
        if (!rawAmt) continue;

        let isNegative = rawAmt.startsWith("-") || rawAmt.includes("Dr") || rawAmt.includes("DR");
        const cleanAmt = rawAmt.replace(/dr|cr/gi, "").trim();
        const parsed = rupeesToPaise(cleanAmt);

        if (mapping.typeColIndex !== undefined) {
          const typeStr = cols[mapping.typeColIndex]?.toUpperCase();
          if (typeStr.includes("CR")) isNegative = false;
          if (typeStr.includes("DR")) isNegative = true;
        }

        direction = isNegative ? "outflow" : "inflow";
        amountPaise = Math.abs(parsed);
      }
    } catch (err: unknown) {
      errors.push({ line: i + 1, error: `Invalid amount format: ${(err as Error).message}` });
      continue;
    }

    if (amountPaise <= 0) continue;

    const refNo = mapping.referenceColIndex !== undefined ? cols[mapping.referenceColIndex]?.trim() : undefined;
    const externalId = refNo || `csv_import_${occurredAt.split("T")[0]}_${amountPaise}_${direction}_${i}`;

    transactions.push({
      externalId,
      description,
      amountPaise,
      currency: DEFAULT_CURRENCY,
      direction,
      occurredAt,
      referenceNumber: refNo,
    });
  }

  const confidenceScore = transactions.length > 0 ? (errors.length === 0 ? 1.0 : 0.85) : 0.0;

  return {
    transactions,
    parsingErrors: errors,
    confidenceScore,
  };
}

/**
 * Parses Open Financial Exchange (OFX) format text.
 */
export function parseOFXStatement(ofxText: string): StatementParseResult {
  const transactions: NormalizedBankTransaction[] = [];
  const errors: { line?: number; error: string }[] = [];

  // Match all <STMTTRN>...</STMTTRN> blocks
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  while ((match = trnRegex.exec(ofxText)) !== null) {
    const block = match[1];

    const trntype = block.match(/<TRNTYPE>([^<\r\n]+)/i)?.[1]?.trim()?.toUpperCase();
    const dtposted = block.match(/<DTPOSTED>([^<\r\n]+)/i)?.[1]?.trim();
    const trnamt = block.match(/<TRNAMT>([^<\r\n]+)/i)?.[1]?.trim();
    const fitid = block.match(/<FITID>([^<\r\n]+)/i)?.[1]?.trim();
    const name = block.match(/<NAME>([^<\r\n]+)/i)?.[1]?.trim();
    const memo = block.match(/<MEMO>([^<\r\n]+)/i)?.[1]?.trim();

    if (!dtposted || !trnamt) {
      errors.push({ error: "Malformed STMTTRN block missing DTPOSTED or TRNAMT." });
      continue;
    }

    // Parse OFX DTPOSTED: YYYYMMDDHHMMSS or YYYYMMDD
    let occurredAt = new Date().toISOString();
    const dateMatch = dtposted.match(/^(\d{4})(\d{2})(\d{2})/);
    if (dateMatch) {
      occurredAt = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T00:00:00.000Z`;
    }

    try {
      const numAmt = parseFloat(trnamt);
      const direction: TransactionDirection = numAmt >= 0 ? "inflow" : "outflow";
      const amountPaise = rupeesToPaise(Math.abs(numAmt).toFixed(2));
      const description = [name, memo].filter(Boolean).join(" - ") || "OFX Transaction";

      transactions.push({
        externalId: fitid || `ofx_${occurredAt.split("T")[0]}_${amountPaise}_${direction}`,
        description,
        amountPaise,
        currency: DEFAULT_CURRENCY,
        direction,
        occurredAt,
        referenceNumber: fitid,
      });
    } catch (err: unknown) {
      errors.push({ error: `OFX amount parsing failure: ${(err as Error).message}` });
    }
  }

  return {
    transactions,
    parsingErrors: errors,
    confidenceScore: transactions.length > 0 ? 0.95 : 0.0,
  };
}

/**
 * Parses Quicken Interchange Format (QIF) statement text.
 */
export function parseQIFStatement(qifText: string): StatementParseResult {
  const transactions: NormalizedBankTransaction[] = [];
  const errors: { line?: number; error: string }[] = [];

  const lines = qifText.split(/\r?\n/);
  let currentDate = "";
  let currentAmountStr = "";
  let currentPayee = "";
  let currentMemo = "";
  let currentNum = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("!")) {
      // Header type, e.g. !Type:Bank
      continue;
    }

    if (line === "^") {
      // End of record
      if (currentDate && currentAmountStr) {
        const occurredAt = parseStatementDate(currentDate) || new Date().toISOString();
        try {
          const numAmt = parseFloat(currentAmountStr.replace(/,/g, ""));
          const direction: TransactionDirection = numAmt >= 0 ? "inflow" : "outflow";
          const amountPaise = rupeesToPaise(Math.abs(numAmt).toFixed(2));
          const description = [currentPayee, currentMemo].filter(Boolean).join(" - ") || "QIF Transaction";

          transactions.push({
            externalId: currentNum || `qif_${occurredAt.split("T")[0]}_${amountPaise}_${direction}_${transactions.length}`,
            description,
            amountPaise,
            currency: DEFAULT_CURRENCY,
            direction,
            occurredAt,
            referenceNumber: currentNum || undefined,
          });
        } catch (err: unknown) {
          errors.push({ line: i + 1, error: `Failed to parse QIF amount: ${(err as Error).message}` });
        }
      }

      currentDate = "";
      currentAmountStr = "";
      currentPayee = "";
      currentMemo = "";
      currentNum = "";
    } else if (line.startsWith("D")) {
      currentDate = line.slice(1).trim();
    } else if (line.startsWith("T")) {
      currentAmountStr = line.slice(1).trim();
    } else if (line.startsWith("P")) {
      currentPayee = line.slice(1).trim();
    } else if (line.startsWith("M")) {
      currentMemo = line.slice(1).trim();
    } else if (line.startsWith("N")) {
      currentNum = line.slice(1).trim();
    }
  }

  return {
    transactions,
    parsingErrors: errors,
    confidenceScore: transactions.length > 0 ? 0.9 : 0.0,
  };
}
