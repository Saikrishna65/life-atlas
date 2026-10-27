/**
 * Life Atlas Finance: Statement Import Application Service
 * 
 * Orchestrates offline bank statement preview, deduplication analysis,
 * automatic category matching, and safe atomic ingestion.
 */

import { IUnitOfWork } from "../storage/interfaces";
import { TransactionService } from "./transactionService";
import { CategorizationService } from "./categorizationService";
import { BalanceService } from "./balanceService";
import {
  parseCSVStatement,
  parseOFXStatement,
  parseQIFStatement,
  ColumnMapping,
} from "../infrastructure/statementParser";
import { NormalizedBankTransaction, StatementFileType } from "../infrastructure/interfaces";
import { ID, Paise, TransactionDirection } from "../domain/models";
import { generateTransactionFingerprint } from "../domain/ledger";
import { FinanceError } from "../domain/errors";

export interface ImportPreviewItem {
  id: string; // temporary row identifier
  externalId: string;
  occurredAt: string;
  description: string;
  merchant?: string;
  amountPaise: Paise;
  direction: TransactionDirection;
  suggestedCategoryId?: ID;
  suggestedCategoryName?: string;
  matchExplanation?: string;
  status: "new" | "duplicate" | "invalid";
  duplicateReason?: string;
  selectedForImport: boolean;
}

export interface ImportPreviewResult {
  fileType: StatementFileType;
  destinationAccountId: string;
  totalParsed: number;
  newCount: number;
  duplicateCount: number;
  invalidCount: number;
  items: ImportPreviewItem[];
  errors: string[];
}

export interface CommitImportResult {
  importedCount: number;
  skippedCount: number;
  totalInflowPaise: Paise;
  totalOutflowPaise: Paise;
  destinationAccountBalancePaise: Paise;
}

export class ImportService {
  private categorizationService: CategorizationService;
  private balanceService: BalanceService;

  constructor(
    private readonly uow: IUnitOfWork,
    private readonly transactionService: TransactionService
  ) {
    this.categorizationService = new CategorizationService(uow);
    this.balanceService = new BalanceService(uow);
  }

  /**
   * Previews a bank statement offline, performs deduplication against existing database transactions
   * and intra-batch duplicates, and suggests categories for new items.
   */
  async previewStatement(
    fileContent: string,
    fileType: StatementFileType,
    destinationAccountId: ID,
    customMapping?: ColumnMapping
  ): Promise<ImportPreviewResult> {
    const account = await this.uow.accounts.getById(destinationAccountId);
    if (!account) {
      throw new FinanceError(`Account ${destinationAccountId} not found`, "NOT_FOUND");
    }

    let parsedResult;
    if (fileType === "csv") {
      parsedResult = parseCSVStatement(fileContent, customMapping);
    } else if (fileType === "ofx") {
      parsedResult = parseOFXStatement(fileContent);
    } else if (fileType === "qif") {
      parsedResult = parseQIFStatement(fileContent);
    } else {
      throw new FinanceError(
        `File format "${fileType}" is not supported offline. Please upload CSV, OFX, or QIF exported from your bank.`,
        "UNSUPPORTED_FORMAT"
      );
    }

    // Fetch existing transactions in this account to detect duplicates
    const existingTransactions = await this.uow.transactions.query({
      accountId: destinationAccountId,
    });

    const existingExternalIds = new Set(
      existingTransactions.map((t) => t.externalId).filter(Boolean) as string[]
    );

    const existingFingerprints = new Set(
      existingTransactions.map((t) => generateTransactionFingerprint(t))
    );

    const seenBatchFingerprints = new Set<string>();
    const seenBatchExternalIds = new Set<string>();

    const previewItems: ImportPreviewItem[] = [];
    let newCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < parsedResult.transactions.length; i++) {
      const item: NormalizedBankTransaction = parsedResult.transactions[i];
      const rowId = `row_${i}_${Date.now()}`;

      if (item.amountPaise <= 0 || !item.occurredAt) {
        previewItems.push({
          id: rowId,
          externalId: item.externalId,
          occurredAt: item.occurredAt,
          description: item.description,
          amountPaise: item.amountPaise,
          direction: item.direction,
          status: "invalid",
          duplicateReason: "Invalid amount or date",
          selectedForImport: false,
        });
        invalidCount++;
        continue;
      }

      // Generate composite fingerprint
      const fp = generateTransactionFingerprint({
        accountId: destinationAccountId,
        amountPaise: item.amountPaise,
        direction: item.direction,
        occurredAt: item.occurredAt,
        description: item.description,
        externalId: item.externalId,
      });

      let isDuplicate = false;
      let duplicateReason: string | undefined;

      // Check external ID
      if (item.externalId && (existingExternalIds.has(item.externalId) || seenBatchExternalIds.has(item.externalId))) {
        isDuplicate = true;
        duplicateReason = "External ID already exists in this account or batch";
      } else if (existingFingerprints.has(fp) || seenBatchFingerprints.has(fp)) {
        isDuplicate = true;
        duplicateReason = "Identical transaction (date, amount, description) already recorded";
      }

      if (isDuplicate) {
        duplicateCount++;
        previewItems.push({
          id: rowId,
          externalId: item.externalId,
          occurredAt: item.occurredAt,
          description: item.description,
          merchant: item.merchantName,
          amountPaise: item.amountPaise,
          direction: item.direction,
          status: "duplicate",
          duplicateReason,
          selectedForImport: false, // Default unselected for duplicates
        });
      } else {
        newCount++;
        seenBatchFingerprints.add(fp);
        if (item.externalId) {
          seenBatchExternalIds.add(item.externalId);
        }

        // Run smart category suggestion
        const suggestion = await this.categorizationService.suggestCategory({
          description: item.description,
          merchant: item.merchantName,
          direction: item.direction,
          amountPaise: item.amountPaise,
        });

        previewItems.push({
          id: rowId,
          externalId: item.externalId,
          occurredAt: item.occurredAt,
          description: item.description,
          merchant: item.merchantName,
          amountPaise: item.amountPaise,
          direction: item.direction,
          suggestedCategoryId: suggestion?.categoryId,
          suggestedCategoryName: suggestion?.categoryName,
          matchExplanation: suggestion?.ruleMatched ? `Rule: ${suggestion.ruleMatched}` : undefined,
          status: "new",
          selectedForImport: true, // Default selected for new items
        });
      }
    }

    return {
      fileType,
      destinationAccountId,
      totalParsed: parsedResult.transactions.length,
      newCount,
      duplicateCount,
      invalidCount,
      items: previewItems,
      errors: parsedResult.parsingErrors.map((e) => e.error),
    };
  }

  /**
   * Commits the selected items into the ledger atomically.
   */
  async commitImport(
    destinationAccountId: ID,
    itemsToImport: ImportPreviewItem[]
  ): Promise<CommitImportResult> {
    const account = await this.uow.accounts.getById(destinationAccountId);
    if (!account) {
      throw new FinanceError(`Account ${destinationAccountId} not found`, "NOT_FOUND");
    }

    const selected = itemsToImport.filter((item) => item.selectedForImport && item.status !== "invalid");
    let importedCount = 0;
    let skippedCount = 0;
    let totalInflowPaise = 0;
    let totalOutflowPaise = 0;

    await this.uow.runInTransaction(async () => {
      for (const item of selected) {
        try {
          await this.transactionService.recordTransaction({
            accountId: destinationAccountId,
            description: item.description,
            merchant: item.merchant,
            amountPaise: item.amountPaise,
            direction: item.direction,
            occurredAt: item.occurredAt,
            categoryId: item.suggestedCategoryId,
            source: "statement_import",
            externalId: item.externalId,
            reviewRequired: !item.suggestedCategoryId,
          });

          importedCount++;
          if (item.direction === "inflow") {
            totalInflowPaise += item.amountPaise;
          } else {
            totalOutflowPaise += item.amountPaise;
          }
        } catch (err: unknown) {
          // If transactionService flags duplicate, safely skip
          const msg = (err as Error).message || "";
          if (msg.includes("Duplicate")) {
            skippedCount++;
          } else {
            throw err;
          }
        }
      }
    });

    const refreshedAccount = await this.uow.accounts.getById(destinationAccountId);

    return {
      importedCount,
      skippedCount,
      totalInflowPaise,
      totalOutflowPaise,
      destinationAccountBalancePaise: refreshedAccount?.currentBalancePaise || 0,
    };
  }
}

