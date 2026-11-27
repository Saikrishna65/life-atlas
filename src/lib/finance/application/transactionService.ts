import { applyRepaymentSelection, type RepaymentSelection } from "../shared/repayment";
import { stageLedgerMutation } from "./ledgerMutation";
import { isControlRestoreActive } from "../../control-room/maintenance";
import { TripFinanceService, loadFinanceTrips } from "../trips/service";
import {
  resolveTripAssignment,
  applyTripCategory,
  tripDetailCategoryId,
} from "../trips/policy";
import type { TripAssignment } from "../trips/policy";
import type { TripRecord } from "../../vault/types";
/**
 * Atlas Finance: Transaction Application Service
 *
 * Handles transaction ingestion, internal transfers, corrections with audit trails,
 * reversals without silent deletion, duplicate prevention, and balance synchronization.
 */

import { IUnitOfWork } from "../storage/interfaces";
import {
  Transaction,
  ID,
  Paise,
  TransactionDirection,
  TransactionStatus,
  TransactionSource,
  CurrencyCode,
} from "../domain/models";
import {
  assertSafePaise,
  DEFAULT_CURRENCY,
  addPaise,
  subtractPaise,
} from "../domain/money";
import {
  generateTransactionFingerprint,
  validateTransferLegs,
} from "../domain/ledger";
import { FinanceError } from "../domain/errors";

export interface RecordTransactionDTO {
  sharedRepayment?: RepaymentSelection;
  sharedSplit?: import("../shared/transactionSplit").TransactionSplit;
  paymentKind?: import("../domain/models").PaymentKind;
  tripAssignment?: TripAssignment;
  recurringRuleId?: string;
  originalTransactionId?: string;
  pocketId?: string;
  accountId: ID;
  description: string;
  merchant?: string;
  amountPaise: Paise;
  currency?: CurrencyCode;
  direction: TransactionDirection;
  status?: TransactionStatus;
  categoryId?: ID;
  source?: TransactionSource;
  externalId?: string;
  occurredAt?: string;
  postedAt?: string;
  reviewRequired?: boolean;
  notes?: string;
  tags?: string[];
}

export interface RecordTransferDTO {
  sourceAccountId: ID;
  destinationAccountId: ID;
  amountPaise: Paise;
  currency?: CurrencyCode;
  description?: string;
  occurredAt?: string;
  postedAt?: string;
  status?: TransactionStatus;
}

export interface CorrectTransactionDTO {
  sharedRepayment?: RepaymentSelection | null;
  sharedSplit?: import("../shared/transactionSplit").TransactionSplit | null;
  reviewRequired?: boolean;
  expectedVersion?: number;
  paymentKind?: import("../domain/models").PaymentKind;
  tripAssignment?: TripAssignment;
  pocketId?: string | null;
  description?: string;
  merchant?: string;
  amountPaise?: Paise;
  direction?: TransactionDirection;
  categoryId?: ID;
  occurredAt?: string;
  status?: TransactionStatus;
  notes?: string;
  tags?: string[];
}

export class TransactionService {
  constructor(
    private uow: IUnitOfWork,
    private loadTrips: () => Promise<TripRecord[]> = loadFinanceTrips,
  ) {}

  async recordTransaction(dto: RecordTransactionDTO) {
    return stageLedgerMutation(this.uow, (staged) =>
      new TransactionService(staged, this.loadTrips).recordTransactionStaged(
        dto,
      ),
    );
  }

  async recordTransfer(dto: RecordTransferDTO) {
    return stageLedgerMutation(this.uow, (staged) =>
      new TransactionService(staged, this.loadTrips).recordTransferStaged(dto),
    );
  }

  async reverseTransaction(id: ID, reason: string) {
    return stageLedgerMutation(this.uow, (staged) =>
      new TransactionService(staged, this.loadTrips).reverseTransactionStaged(
        id,
        reason,
      ),
    );
  }

  async deleteTransaction(id: ID) {
    return stageLedgerMutation(this.uow, (staged) =>
      new TransactionService(staged, this.loadTrips).deleteTransactionStaged(
        id,
      ),
    );
  }

  async correctTransaction(
    id: ID,
    updates: CorrectTransactionDTO,
    reason: string,
  ) {
    return stageLedgerMutation(this.uow, (staged) =>
      new TransactionService(staged, this.loadTrips).correctTransactionStaged(
        id,
        updates,
        reason,
      ),
    );
  }

  async availableTrips() {
    return this.loadTrips();
  }

  /**
   * Records a new transaction with duplicate prevention and automatic balance adjustment
   */
  private async recordTransactionStaged(
    dto: RecordTransactionDTO,
  ): Promise<Transaction> {
    if (isControlRestoreActive())
      throw new FinanceError(
        "A restore is in progress. Try again when it finishes.",
        "CONCURRENCY_CONFLICT",
      );
    const account = await this.uow.accounts.getById(dto.accountId);
    if (!account) {
      throw new FinanceError(
        `Account ${dto.accountId} not found`,
        "INVALID_ACCOUNT",
      );
    }
    if (account.status === "archived") {
      throw new FinanceError(
        `Cannot add transactions to archived account ${dto.accountId}`,
        "ACCOUNT_ARCHIVED",
      );
    }

    assertSafePaise(dto.amountPaise, "Transaction amount");
    if (dto.amountPaise <= 0) {
      throw new FinanceError(
        "Transaction amount must be strictly positive",
        "INVALID_AMOUNT",
      );
    }

    const now = new Date().toISOString();
    const occurredAt = dto.occurredAt
      ? new Date(dto.occurredAt).toISOString()
      : now;
    const status = dto.status || "posted";
    const currency = dto.currency || account.currency || DEFAULT_CURRENCY;
    if (currency !== account.currency)
      throw new FinanceError(
        "Payment currency must match its account.",
        "CURRENCY_MISMATCH",
      );

    // Duplicate check: check external ID or identical amount/direction/description on same day
    if (dto.externalId) {
      const existingByExternal = await this.uow.transactions.getByExternalId(
        dto.externalId,
      );
      if (existingByExternal?.accountId === dto.accountId) {
        throw new FinanceError(
          `Duplicate transaction detected: External ID "${dto.externalId}" already exists (txn ${existingByExternal.id})`,
          "DUPLICATE_TRANSACTION",
          { existingId: existingByExternal.id },
        );
      }
    }

    // Check same-day fingerprint
    const fingerprint = generateTransactionFingerprint({
      accountId: dto.accountId,
      amountPaise: dto.amountPaise,
      direction: dto.direction,
      occurredAt,
      description: dto.description,
      externalId: dto.externalId,
    });

    const dayPrefix = occurredAt.split("T")[0];
    const existingSameDay = await this.uow.transactions.query({
      accountId: dto.accountId,
      startDate: `${dayPrefix}T00:00:00.000Z`,
      endDate: `${dayPrefix}T23:59:59.999Z`,
      direction: dto.direction,
      minAmountPaise: dto.amountPaise,
      maxAmountPaise: dto.amountPaise,
    });

    for (const existing of existingSameDay) {
      const existingFp = generateTransactionFingerprint(existing);
      if (existingFp === fingerprint) {
        throw new FinanceError(
          `Duplicate transaction detected: Matching transaction ${existing.id} recorded on ${dayPrefix}`,
          "DUPLICATE_TRANSACTION",
          { existingId: existing.id },
        );
      }
    }

    const id: ID = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const transaction: Transaction = {
      id,
      paymentKind: dto.paymentKind,
      tripAssignment: dto.tripAssignment,
      recurringRuleId: dto.recurringRuleId,
      sharedSplit: dto.sharedSplit,
      originalTransactionId: dto.originalTransactionId,
      accountId: dto.accountId,
      description: dto.description.trim(),
      merchant: dto.merchant?.trim(),
      amountPaise: dto.amountPaise,
      currency,
      direction: dto.direction,
      status,
      categoryId: dto.categoryId,
      source: dto.source || "manual",
      externalId: dto.externalId,
      occurredAt,
      postedAt: status === "posted" ? dto.postedAt || occurredAt : undefined,
      reviewRequired: dto.reviewRequired ?? false,
      notes: dto.notes,
      tags: dto.tags,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    applyRepaymentSelection(transaction, null, dto.sharedRepayment);
    if (dto.pocketId && dto.direction === "outflow") {
      const pocket = await this.uow.savingsGoals.getById(dto.pocketId);
      if (!pocket) {
        throw new FinanceError(
          `Pocket ${dto.pocketId} not found`,
          "POCKET_NOT_FOUND",
        );
      }
      if (pocket.linkedAccountId && pocket.linkedAccountId !== dto.accountId) {
        throw new FinanceError(
          "Selected pocket is not linked to this account",
          "ACCOUNT_MISMATCH",
        );
      }
      const deductionPaise = Math.min(
        pocket.allocatedPaise || 0,
        dto.amountPaise,
      );
      if (deductionPaise > 0) {
        const newAllocated = subtractPaise(
          pocket.allocatedPaise || 0,
          deductionPaise,
        );
        pocket.allocatedPaise = newAllocated;
        pocket.currentAmountPaise = newAllocated;
        pocket.history = [
          ...(pocket.history || []),
          {
            id: `pkh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            pocketId: pocket.id,
            type: "spend",
            amountPaise: deductionPaise,
            balanceAfterPaise: newAllocated,
            occurredAt,
            note: `Spent on: ${dto.description.trim()}`,
            transactionId: id,
          },
        ];
        pocket.updatedAt = now;
        pocket.version = (pocket.version || 1) + 1;
        await this.uow.savingsGoals.save(pocket);
        transaction.pocketId = pocket.id;
        transaction.pocketDeductionPaise = deductionPaise;
      }
    }

    const tripContext = await new TripFinanceService(
      this.uow,
      this.loadTrips,
    ).context();
    if (transaction.tripAssignment?.mode === "manual") {
      const target = tripContext.trips.find(
        (t) => t.id === transaction.tripAssignment?.tripId,
      );
      if (
        !target ||
        target.currency !== transaction.currency ||
        transaction.direction !== "outflow" ||
        tripContext.categories.some(
          (c) =>
            c.id === tripDetailCategoryId(transaction) && c.type === "transfer",
        )
      )
        throw new FinanceError(
          "Choose a trip with the same currency for an expense.",
          "INVALID_TRIP",
        );
      transaction.tripAssignment = {
        ...transaction.tripAssignment,
        tripTitle: target.title,
      };
    } else
      transaction.tripAssignment = resolveTripAssignment(
        transaction,
        tripContext,
      );
    Object.assign(
      transaction,
      applyTripCategory(transaction, transaction.tripAssignment),
    );
    await this.uow.transactions.save(transaction);

    // Update account balance

    // Record audit event
    await this.uow.audit.record({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      entityType: "transaction",
      entityId: id,
      action: "create",
      changes: { created: { oldVal: null, newVal: transaction } },
      performedAt: now,
    });

    // Enqueue outbox op
    await this.uow.outbox.enqueue({
      id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      entityType: "transaction",
      entityId: id,
      action: "create",
      payloadJson: JSON.stringify(transaction),
      timestamp: now,
      status: "pending",
      retryCount: 0,
      idempotencyKey: `create_txn_${id}`,
    });

    return transaction;
  }

  /**
   * Records an internal transfer between two user-owned accounts
   * Creates two linked legs sharing the exact same transferGroupId.
   */
  private async recordTransferStaged(dto: RecordTransferDTO): Promise<{
    sourceTransaction: Transaction;
    destinationTransaction: Transaction;
    transferGroupId: ID;
  }> {
    if (dto.sourceAccountId === dto.destinationAccountId) {
      throw new FinanceError(
        "Source and destination accounts must be distinct",
        "INVALID_TRANSFER",
      );
    }

    const [sourceAcc, destAcc] = await Promise.all([
      this.uow.accounts.getById(dto.sourceAccountId),
      this.uow.accounts.getById(dto.destinationAccountId),
    ]);

    if (!sourceAcc || sourceAcc.status === "archived") {
      throw new FinanceError(
        `Invalid or archived source account ${dto.sourceAccountId}`,
        "INVALID_ACCOUNT",
      );
    }
    if (!destAcc || destAcc.status === "archived") {
      throw new FinanceError(
        `Invalid or archived destination account ${dto.destinationAccountId}`,
        "INVALID_ACCOUNT",
      );
    }

    assertSafePaise(dto.amountPaise, "Transfer amount");
    if (dto.amountPaise <= 0) {
      throw new FinanceError(
        "Transfer amount must be strictly positive",
        "INVALID_AMOUNT",
      );
    }

    const now = new Date().toISOString();
    const occurredAt = dto.occurredAt
      ? new Date(dto.occurredAt).toISOString()
      : now;
    const status = dto.status || "posted";
    const currency = dto.currency || sourceAcc.currency || DEFAULT_CURRENCY;
    if (
      sourceAcc.currency !== destAcc.currency ||
      currency !== sourceAcc.currency
    )
      throw new FinanceError(
        "Transfers require accounts with the same currency.",
        "CURRENCY_MISMATCH",
      );
    const transferGroupId: ID = `trf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const desc =
      dto.description?.trim() ||
      `Transfer from ${sourceAcc.name} to ${destAcc.name}`;

    const sourceTxn: Transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_out`,
      accountId: dto.sourceAccountId,
      description: desc,
      amountPaise: dto.amountPaise,
      currency,
      direction: "outflow",
      status,
      source: "manual",
      occurredAt,
      postedAt: status === "posted" ? dto.postedAt || occurredAt : undefined,
      transferGroupId,
      reviewRequired: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const destTxn: Transaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_in`,
      accountId: dto.destinationAccountId,
      description: desc,
      amountPaise: dto.amountPaise,
      currency,
      direction: "inflow",
      status,
      source: "manual",
      occurredAt,
      postedAt: status === "posted" ? dto.postedAt || occurredAt : undefined,
      transferGroupId,
      reviewRequired: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    validateTransferLegs(sourceTxn, destTxn);

    // Save both transactions in batch
    await this.uow.transactions.saveBatch([sourceTxn, destTxn]);

    // Update balances of both accounts

    // Record audit events
    await Promise.all([
      this.uow.audit.record({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        entityType: "transaction",
        entityId: sourceTxn.id,
        action: "create",
        changes: { createdTransferOut: { oldVal: null, newVal: sourceTxn } },
        performedAt: now,
      }),
      this.uow.audit.record({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        entityType: "transaction",
        entityId: destTxn.id,
        action: "create",
        changes: { createdTransferIn: { oldVal: null, newVal: destTxn } },
        performedAt: now,
      }),
    ]);

    return {
      sourceTransaction: sourceTxn,
      destinationTransaction: destTxn,
      transferGroupId,
    };
  }

  /**
   * Reverses a transaction without deleting it from the audit ledger
   */
  private async reverseTransactionStaged(
    id: ID,
    reason: string,
  ): Promise<Transaction> {
    const existing = await this.uow.transactions.getById(id);
    if (!existing) {
      throw new FinanceError(
        `Transaction ${id} not found`,
        "TRANSACTION_NOT_FOUND",
      );
    }

    if (existing.status === "reversed") {
      throw new FinanceError(
        `Transaction ${id} is already reversed`,
        "TRANSACTION_ALREADY_REVERSED",
      );
    }

    const now = new Date().toISOString();
    const oldStatus = existing.status;
    existing.status = "reversed";
    existing.notes = existing.notes
      ? `${existing.notes} | Reversed: ${reason}`
      : `Reversed: ${reason}`;
    existing.updatedAt = now;
    existing.version = (existing.version || 1) + 1;

    await this.uow.transactions.save(existing);

    // Restore pocket allocation if this transaction spent from a savings pocket
    if (
      existing.pocketId &&
      existing.pocketDeductionPaise &&
      existing.pocketDeductionPaise > 0
    ) {
      const pocket = await this.uow.savingsGoals.getById(existing.pocketId);
      if (pocket) {
        const restored = addPaise(
          pocket.allocatedPaise || 0,
          existing.pocketDeductionPaise,
        );
        pocket.allocatedPaise = restored;
        pocket.currentAmountPaise = restored;
        pocket.history = [
          ...(pocket.history || []),
          {
            id: `pkh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            pocketId: pocket.id,
            type: "refund",
            amountPaise: existing.pocketDeductionPaise,
            balanceAfterPaise: restored,
            occurredAt: now,
            note: `Restored from reversed payment: ${existing.description}`,
            transactionId: existing.id,
          },
        ];
        pocket.updatedAt = now;
        pocket.version = (pocket.version || 1) + 1;
        await this.uow.savingsGoals.save(pocket);
      }
    }

    // Audit log
    await this.uow.audit.record({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      entityType: "transaction",
      entityId: id,
      action: "reverse",
      changes: {
        status: { oldVal: oldStatus, newVal: "reversed" },
      },
      reason,
      performedAt: now,
    });

    // If part of an internal transfer, reverse the opposite leg as well
    if (existing.transferGroupId) {
      const legs = await this.uow.transactions.getByTransferGroupId(
        existing.transferGroupId,
      );
      for (const leg of legs) {
        if (leg.id !== id && leg.status !== "reversed") {
          leg.status = "reversed";
          leg.notes = leg.notes
            ? `${leg.notes} | Transfer reversed: ${reason}`
            : `Transfer reversed: ${reason}`;
          leg.updatedAt = now;
          leg.version = (leg.version || 1) + 1;
          await this.uow.transactions.save(leg);
        }
      }
    }

    return existing;
  }

  /**
   * Deletes a transaction while safely restoring any pocket allocation.
   */
  private async deleteTransactionStaged(id: ID): Promise<void> {
    const { authorize } = await import("../../security/authentication");
    await authorize("deletion");
    const selected = await this.uow.transactions.getById(id);
    if (!selected) return;
    const linked = selected.transferGroupId
      ? await this.uow.transactions.getByTransferGroupId(
          selected.transferGroupId,
        )
      : [selected];
    for (const existing of linked) {
      if (
        existing.status !== "reversed" &&
        existing.pocketId &&
        existing.pocketDeductionPaise &&
        existing.pocketDeductionPaise > 0
      ) {
        const pocket = await this.uow.savingsGoals.getById(existing.pocketId);
        if (pocket) {
          const restored = addPaise(
            pocket.allocatedPaise || 0,
            existing.pocketDeductionPaise,
          );
          pocket.allocatedPaise = restored;
          pocket.currentAmountPaise = restored;
          pocket.history = [
            ...(pocket.history || []),
            {
              id: `pkh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              pocketId: pocket.id,
              type: "refund",
              amountPaise: existing.pocketDeductionPaise,
              balanceAfterPaise: restored,
              occurredAt: new Date().toISOString(),
              note: `Restored from deleted payment: ${existing.description}`,
              transactionId: existing.id,
            },
          ];
          pocket.updatedAt = new Date().toISOString();
          pocket.version = (pocket.version || 1) + 1;
          await this.uow.savingsGoals.save(pocket);
        }
      }

      await this.uow.transactions.delete(existing.id);
    }
  }

  /**
   * Corrects a user-editable transaction field while retaining comprehensive audit trail
   */
  private async correctTransactionStaged(
    id: ID,
    updates: CorrectTransactionDTO,
    reason: string,
  ): Promise<Transaction> {
    const existing = await this.uow.transactions.getById(id);
    if (!existing) {
      throw new FinanceError(
        `Transaction ${id} not found`,
        "TRANSACTION_NOT_FOUND",
      );
    }

    if (
      updates.expectedVersion !== undefined &&
      updates.expectedVersion !== existing.version
    )
      throw new FinanceError(
        "This payment changed while you were editing. Reopen it to review the latest version.",
        "CONCURRENCY_CONFLICT",
      );
    if (
      existing.transferGroupId &&
      ((updates.amountPaise !== undefined &&
        updates.amountPaise !== existing.amountPaise) ||
        (updates.direction !== undefined &&
          updates.direction !== existing.direction) ||
        (updates.status !== undefined && updates.status !== existing.status) ||
        updates.pocketId)
    ) {
      throw new FinanceError(
        "A transfer must stay balanced. Reverse it and create a new transfer to change the amount or status.",
        "INVALID_TRANSFER",
      );
    }
    const previous = {
      ...existing,
      tripAssignment: existing.tripAssignment
        ? { ...existing.tripAssignment }
        : undefined,
    };
    const now = new Date().toISOString();
    const changes: Record<string, { oldVal: unknown; newVal: unknown }> = {};

    if (
      updates.paymentKind !== undefined &&
      updates.paymentKind !== existing.paymentKind
    ) {
      if (
        ![
          "purchase",
          "salary",
          "refund",
          "transfer",
          "automatic_bill",
          "reimbursement",
        ].includes(updates.paymentKind)
      )
        throw new FinanceError(
          "Choose a valid payment type.",
          "VALIDATION_FAILED",
        );
      changes.paymentKind = {
        oldVal: existing.paymentKind,
        newVal: updates.paymentKind,
      };
      existing.paymentKind = updates.paymentKind;
    }
    if (
      updates.description &&
      updates.description.trim() !== existing.description
    ) {
      changes.description = {
        oldVal: existing.description,
        newVal: updates.description.trim(),
      };
      existing.description = updates.description.trim();
    }

    if (
      updates.merchant !== undefined &&
      updates.merchant !== existing.merchant
    ) {
      changes.merchant = {
        oldVal: existing.merchant,
        newVal: updates.merchant,
      };
      existing.merchant = updates.merchant;
    }

    if (
      updates.amountPaise !== undefined &&
      updates.amountPaise !== existing.amountPaise
    ) {
      assertSafePaise(updates.amountPaise, "Updated amount");
      if (updates.amountPaise <= 0) {
        throw new FinanceError(
          "Transaction amount must be strictly positive",
          "INVALID_AMOUNT",
        );
      }
      changes.amountPaise = {
        oldVal: existing.amountPaise,
        newVal: updates.amountPaise,
      };
      existing.amountPaise = updates.amountPaise;
    }

    if (
      updates.direction !== undefined &&
      updates.direction !== existing.direction
    ) {
      changes.direction = {
        oldVal: existing.direction,
        newVal: updates.direction,
      };
      existing.direction = updates.direction;
    }

    if (
      updates.categoryId !== undefined &&
      updates.categoryId !== existing.categoryId
    ) {
      changes.categoryId = {
        oldVal: existing.categoryId,
        newVal: updates.categoryId,
      };
      existing.categoryId = updates.categoryId;
    }

    if (
      updates.occurredAt !== undefined &&
      updates.occurredAt !== existing.occurredAt
    ) {
      if (!Number.isFinite(Date.parse(updates.occurredAt)))
        throw new FinanceError("Enter a valid payment time.", "INVALID_DATE");
      changes.occurredAt = {
        oldVal: existing.occurredAt,
        newVal: updates.occurredAt,
      };
      existing.occurredAt = updates.occurredAt;
    }

    if (updates.status !== undefined && updates.status !== existing.status) {
      changes.status = { oldVal: existing.status, newVal: updates.status };
      existing.status = updates.status;
    }

    if (updates.notes !== undefined && updates.notes !== existing.notes) {
      changes.notes = { oldVal: existing.notes, newVal: updates.notes };
      existing.notes = updates.notes;
    }

    if (updates.tags !== undefined) {
      changes.tags = { oldVal: existing.tags, newVal: updates.tags };
      existing.tags = updates.tags;
    }

    if (updates.tripAssignment !== undefined) {
      changes.tripAssignment = {
        oldVal: existing.tripAssignment,
        newVal: updates.tripAssignment,
      };
      existing.tripAssignment = updates.tripAssignment;
    }
    const tripContext = await new TripFinanceService(
      this.uow,
      this.loadTrips,
    ).context();
    if (existing.tripAssignment?.mode === "manual") {
      const target = tripContext.trips.find(
        (t) => t.id === existing.tripAssignment?.tripId,
      );
      if (
        !target ||
        target.currency !== existing.currency ||
        existing.direction !== "outflow" ||
        existing.transferGroupId ||
        tripContext.categories.some(
          (c) =>
            c.id === tripDetailCategoryId(existing) && c.type === "transfer",
        )
      )
        throw new FinanceError(
          "Choose a trip with the same currency for an expense.",
          "INVALID_TRIP",
        );
      existing.tripAssignment = {
        ...existing.tripAssignment,
        tripTitle: target.title,
      };
    }
    const nextAssignment = resolveTripAssignment(existing, tripContext);
    Object.assign(
      existing,
      applyTripCategory(existing, nextAssignment, previous, updates.categoryId),
    );
    if (
      JSON.stringify(previous.tripAssignment) !==
      JSON.stringify(existing.tripAssignment)
    )
      changes.tripAssignment = {
        oldVal: previous.tripAssignment,
        newVal: existing.tripAssignment,
      };
    else delete changes.tripAssignment;
    if (previous.categoryId !== existing.categoryId)
      changes.categoryId = {
        oldVal: previous.categoryId,
        newVal: existing.categoryId,
      };
    else delete changes.categoryId;

    if (updates.sharedSplit !== undefined) {
      const nextSplit = updates.sharedSplit || undefined;
      if (JSON.stringify(previous.sharedSplit) !== JSON.stringify(nextSplit)) changes.sharedSplit = { oldVal: previous.sharedSplit, newVal: nextSplit };
      existing.sharedSplit = nextSplit;
    }
    if (updates.reviewRequired !== undefined && updates.reviewRequired !== previous.reviewRequired) {
      changes.reviewRequired = { oldVal: previous.reviewRequired, newVal: updates.reviewRequired };
      existing.reviewRequired = updates.reviewRequired;
    }
    applyRepaymentSelection(existing, previous, updates.sharedRepayment);
    for (const field of ["sharedRepayment", "paymentKind", "categoryId"] as const) if (JSON.stringify(previous[field]) !== JSON.stringify(existing[field])) changes[field] = {oldVal:previous[field], newVal:existing[field]};
    const pocketChanged =
      (updates.pocketId !== undefined &&
        (updates.pocketId || undefined) !== previous.pocketId) ||
      existing.amountPaise !== previous.amountPaise ||
      existing.status !== previous.status ||
      existing.direction !== previous.direction;
    if (pocketChanged) {
      const desiredPocket =
        updates.pocketId === undefined
          ? previous.pocketId
          : updates.pocketId || undefined;
      const adjust = async (
        pocketId: string,
        amount: number,
        kind: "refund" | "spend",
      ) => {
        const pocket = await this.uow.savingsGoals.getById(pocketId);
        if (
          !pocket ||
          (kind === "spend" &&
            (pocket.linkedAccountId !== existing.accountId ||
              pocket.status === "archived"))
        )
          throw new FinanceError(
            "Choose an active pocket linked to this account.",
            "ACCOUNT_MISMATCH",
          );
        const applied =
          kind === "refund"
            ? amount
            : Math.min(pocket.allocatedPaise || 0, amount);
        if (!applied) return 0;
        const balance =
          kind === "refund"
            ? addPaise(pocket.allocatedPaise || 0, applied)
            : subtractPaise(pocket.allocatedPaise || 0, applied);
        pocket.allocatedPaise = balance;
        pocket.currentAmountPaise = balance;
        pocket.history = [
          ...(pocket.history || []),
          {
            id: crypto.randomUUID(),
            pocketId,
            type: kind,
            amountPaise: applied,
            balanceAfterPaise: balance,
            occurredAt: now,
            note: `Payment corrected: ${existing.description}`,
            transactionId: existing.id,
          },
        ];
        pocket.updatedAt = now;
        pocket.version = (pocket.version || 1) + 1;
        await this.uow.savingsGoals.save(pocket);
        return applied;
      };
      if (
        previous.status !== "reversed" &&
        previous.pocketId &&
        previous.pocketDeductionPaise
      )
        await adjust(
          previous.pocketId,
          previous.pocketDeductionPaise,
          "refund",
        );
      existing.pocketId = undefined;
      existing.pocketDeductionPaise = undefined;
      if (
        desiredPocket &&
        existing.direction === "outflow" &&
        existing.status !== "reversed"
      ) {
        existing.pocketId = desiredPocket;
        existing.pocketDeductionPaise = await adjust(
          desiredPocket,
          existing.amountPaise,
          "spend",
        );
      }
      changes.pocketId = {
        oldVal: previous.pocketId,
        newVal: existing.pocketId,
      };
    }
    if (
      existing.status === "posted" &&
      (previous.status !== "posted" || changes.occurredAt)
    )
      existing.postedAt = existing.occurredAt;
    else if (existing.status !== "posted") existing.postedAt = undefined;

    if (Object.keys(changes).length === 0) {
      return existing; // No modifications
    }

    existing.updatedAt = now;
    existing.version = (existing.version || 1) + 1;

    await this.uow.transactions.save(existing);

    // Audit log
    await this.uow.audit.record({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      entityType: "transaction",
      entityId: id,
      action: "correct",
      changes,
      reason,
      performedAt: now,
    });

    return existing;
  }
}
