/**
 * Life Atlas Finance: Transaction Application Service
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
import { assertSafePaise, DEFAULT_CURRENCY } from "../domain/money";
import {
  computeAccountBalances,
  generateTransactionFingerprint,
  validateTransferLegs,
} from "../domain/ledger";
import { FinanceError } from "../domain/errors";

export interface RecordTransactionDTO {
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
  constructor(private uow: IUnitOfWork) {}

  /**
   * Records a new transaction with duplicate prevention and automatic balance adjustment
   */
  async recordTransaction(dto: RecordTransactionDTO): Promise<Transaction> {
    const account = await this.uow.accounts.getById(dto.accountId);
    if (!account) {
      throw new FinanceError(`Account ${dto.accountId} not found`, "INVALID_ACCOUNT");
    }
    if (account.status === "archived") {
      throw new FinanceError(`Cannot add transactions to archived account ${dto.accountId}`, "ACCOUNT_ARCHIVED");
    }

    assertSafePaise(dto.amountPaise, "Transaction amount");
    if (dto.amountPaise <= 0) {
      throw new FinanceError("Transaction amount must be strictly positive", "INVALID_AMOUNT");
    }

    const now = new Date().toISOString();
    const occurredAt = dto.occurredAt || now;
    const status = dto.status || "posted";
    const currency = dto.currency || account.currency || DEFAULT_CURRENCY;

    // Duplicate check: check external ID or identical amount/direction/description on same day
    if (dto.externalId) {
      const existingByExternal = await this.uow.transactions.getByExternalId(dto.externalId);
      if (existingByExternal) {
        throw new FinanceError(
          `Duplicate transaction detected: External ID "${dto.externalId}" already exists (txn ${existingByExternal.id})`,
          "DUPLICATE_TRANSACTION",
          { existingId: existingByExternal.id }
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
          { existingId: existing.id }
        );
      }
    }

    const id: ID = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const transaction: Transaction = {
      id,
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

    await this.uow.transactions.save(transaction);

    // Update account balance
    await this.recalculateBalance(account.id);

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
  async recordTransfer(dto: RecordTransferDTO): Promise<{
    sourceTransaction: Transaction;
    destinationTransaction: Transaction;
    transferGroupId: ID;
  }> {
    if (dto.sourceAccountId === dto.destinationAccountId) {
      throw new FinanceError("Source and destination accounts must be distinct", "INVALID_TRANSFER");
    }

    const [sourceAcc, destAcc] = await Promise.all([
      this.uow.accounts.getById(dto.sourceAccountId),
      this.uow.accounts.getById(dto.destinationAccountId),
    ]);

    if (!sourceAcc || sourceAcc.status === "archived") {
      throw new FinanceError(`Invalid or archived source account ${dto.sourceAccountId}`, "INVALID_ACCOUNT");
    }
    if (!destAcc || destAcc.status === "archived") {
      throw new FinanceError(`Invalid or archived destination account ${dto.destinationAccountId}`, "INVALID_ACCOUNT");
    }

    assertSafePaise(dto.amountPaise, "Transfer amount");
    if (dto.amountPaise <= 0) {
      throw new FinanceError("Transfer amount must be strictly positive", "INVALID_AMOUNT");
    }

    const now = new Date().toISOString();
    const occurredAt = dto.occurredAt || now;
    const status = dto.status || "posted";
    const currency = dto.currency || sourceAcc.currency || DEFAULT_CURRENCY;
    const transferGroupId: ID = `trf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const desc = dto.description?.trim() || `Transfer from ${sourceAcc.name} to ${destAcc.name}`;

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
    await Promise.all([
      this.recalculateBalance(sourceAcc.id),
      this.recalculateBalance(destAcc.id),
    ]);

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
  async reverseTransaction(id: ID, reason: string): Promise<Transaction> {
    const existing = await this.uow.transactions.getById(id);
    if (!existing) {
      throw new FinanceError(`Transaction ${id} not found`, "TRANSACTION_NOT_FOUND");
    }

    if (existing.status === "reversed") {
      throw new FinanceError(`Transaction ${id} is already reversed`, "TRANSACTION_ALREADY_REVERSED");
    }

    const now = new Date().toISOString();
    const oldStatus = existing.status;
    existing.status = "reversed";
    existing.notes = existing.notes ? `${existing.notes} | Reversed: ${reason}` : `Reversed: ${reason}`;
    existing.updatedAt = now;
    existing.version = (existing.version || 1) + 1;

    await this.uow.transactions.save(existing);
    await this.recalculateBalance(existing.accountId);

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
      const legs = await this.uow.transactions.getByTransferGroupId(existing.transferGroupId);
      for (const leg of legs) {
        if (leg.id !== id && leg.status !== "reversed") {
          leg.status = "reversed";
          leg.notes = leg.notes ? `${leg.notes} | Transfer reversed: ${reason}` : `Transfer reversed: ${reason}`;
          leg.updatedAt = now;
          leg.version = (leg.version || 1) + 1;
          await this.uow.transactions.save(leg);
          await this.recalculateBalance(leg.accountId);
        }
      }
    }

    return existing;
  }

  /**
   * Corrects a user-editable transaction field while retaining comprehensive audit trail
   */
  async correctTransaction(
    id: ID,
    updates: CorrectTransactionDTO,
    reason: string
  ): Promise<Transaction> {
    const existing = await this.uow.transactions.getById(id);
    if (!existing) {
      throw new FinanceError(`Transaction ${id} not found`, "TRANSACTION_NOT_FOUND");
    }

    const now = new Date().toISOString();
    const changes: Record<string, { oldVal: unknown; newVal: unknown }> = {};

    if (updates.description && updates.description.trim() !== existing.description) {
      changes.description = { oldVal: existing.description, newVal: updates.description.trim() };
      existing.description = updates.description.trim();
    }

    if (updates.merchant !== undefined && updates.merchant !== existing.merchant) {
      changes.merchant = { oldVal: existing.merchant, newVal: updates.merchant };
      existing.merchant = updates.merchant;
    }

    if (updates.amountPaise !== undefined && updates.amountPaise !== existing.amountPaise) {
      assertSafePaise(updates.amountPaise, "Updated amount");
      if (updates.amountPaise <= 0) {
        throw new FinanceError("Transaction amount must be strictly positive", "INVALID_AMOUNT");
      }
      changes.amountPaise = { oldVal: existing.amountPaise, newVal: updates.amountPaise };
      existing.amountPaise = updates.amountPaise;
    }

    if (updates.direction !== undefined && updates.direction !== existing.direction) {
      changes.direction = { oldVal: existing.direction, newVal: updates.direction };
      existing.direction = updates.direction;
    }

    if (updates.categoryId !== undefined && updates.categoryId !== existing.categoryId) {
      changes.categoryId = { oldVal: existing.categoryId, newVal: updates.categoryId };
      existing.categoryId = updates.categoryId;
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

    if (Object.keys(changes).length === 0) {
      return existing; // No modifications
    }

    existing.updatedAt = now;
    existing.version = (existing.version || 1) + 1;

    await this.uow.transactions.save(existing);
    await this.recalculateBalance(existing.accountId);

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

  private async recalculateBalance(accountId: ID): Promise<void> {
    const account = await this.uow.accounts.getById(accountId);
    if (!account) return;

    const txns = await this.uow.transactions.query({ accountId });
    const computed = computeAccountBalances(account, txns);
    await this.uow.accounts.updateBalance(accountId, computed.postedBalancePaise);
  }
}

