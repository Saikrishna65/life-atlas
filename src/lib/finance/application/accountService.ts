/**
 * Life Atlas Finance: Account Application Service
 * 
 * Manages account lifecycle, opening balance setup, archiving, and balance recalculation.
 */

import { IUnitOfWork } from "../storage/interfaces";
import {
  FinanceAccount,
  AccountType,
  AccountMetadata,
  ID,
  Paise,
} from "../domain/models";
import { assertSafePaise, DEFAULT_CURRENCY } from "../domain/money";
import { computeAccountBalances } from "../domain/ledger";
import { FinanceError } from "../domain/errors";

export interface CreateAccountDTO {
  name: string;
  accountType: AccountType;
  currency?: string;
  openingBalancePaise?: Paise;
  openingBalanceDate?: string;
  metadata?: AccountMetadata;
}

export interface UpdateAccountDTO {
  name?: string;
  metadata?: AccountMetadata;
}

export class AccountService {
  constructor(private uow: IUnitOfWork) {}

  async getAccount(id: ID): Promise<FinanceAccount | null> {
    return this.uow.accounts.getById(id);
  }

  /**
   * Creates a new financial account. Opening balance is initialized into current balance.
   */
  async createAccount(dto: CreateAccountDTO): Promise<FinanceAccount> {
    if (!dto.name || !dto.name.trim()) {
      throw new FinanceError("Account name is required", "VALIDATION_FAILED");
    }

    const openingBalance = dto.openingBalancePaise || 0;
    assertSafePaise(openingBalance, "Opening balance");

    const now = new Date().toISOString();
    const id: ID = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const account: FinanceAccount = {
      id,
      name: dto.name.trim(),
      accountType: dto.accountType,
      currency: dto.currency || DEFAULT_CURRENCY,
      openingBalancePaise: openingBalance,
      openingBalanceDate: dto.openingBalanceDate || now,
      currentBalancePaise: openingBalance,
      metadata: dto.metadata,
      status: "active",
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await this.uow.accounts.save(account);

    // Audit log
    await this.uow.audit.record({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      entityType: "account",
      entityId: account.id,
      action: "create",
      changes: {
        created: { oldVal: null, newVal: account },
      },
      performedAt: now,
    });

    // Enqueue outbox op
    await this.uow.outbox.enqueue({
      id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      entityType: "account",
      entityId: account.id,
      action: "create",
      payloadJson: JSON.stringify(account),
      timestamp: now,
      status: "pending",
      retryCount: 0,
      idempotencyKey: `create_acc_${account.id}`,
    });

    return account;
  }

  /**
   * Updates an existing account's display parameters
   */
  async updateAccount(id: ID, dto: UpdateAccountDTO): Promise<FinanceAccount> {
    const existing = await this.uow.accounts.getById(id);
    if (!existing) {
      throw new FinanceError(`Account ${id} not found`, "INVALID_ACCOUNT");
    }

    const now = new Date().toISOString();
    const changes: Record<string, { oldVal: unknown; newVal: unknown }> = {};

    if (dto.name && dto.name.trim() !== existing.name) {
      changes.name = { oldVal: existing.name, newVal: dto.name.trim() };
      existing.name = dto.name.trim();
    }

    if (dto.metadata) {
      changes.metadata = { oldVal: existing.metadata, newVal: dto.metadata };
      existing.metadata = { ...existing.metadata, ...dto.metadata };
    }

    existing.updatedAt = now;
    existing.version = (existing.version || 1) + 1;

    await this.uow.accounts.save(existing);

    if (Object.keys(changes).length > 0) {
      await this.uow.audit.record({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        entityType: "account",
        entityId: id,
        action: "update",
        changes,
        performedAt: now,
      });

      await this.uow.outbox.enqueue({
        id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        entityType: "account",
        entityId: id,
        action: "update",
        payloadJson: JSON.stringify(existing),
        timestamp: now,
        status: "pending",
        retryCount: 0,
        idempotencyKey: `update_acc_${id}_v${existing.version}`,
      });
    }

    return existing;
  }

  /**
   * Archives an account
   */
  async archiveAccount(id: ID): Promise<void> {
    const existing = await this.uow.accounts.getById(id);
    if (!existing) {
      throw new FinanceError(`Account ${id} not found`, "INVALID_ACCOUNT");
    }

    await this.uow.accounts.archive(id);

    const now = new Date().toISOString();
    await this.uow.audit.record({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      entityType: "account",
      entityId: id,
      action: "archive",
      changes: {
        status: { oldVal: existing.status, newVal: "archived" },
      },
      performedAt: now,
    });
  }

  /**
   * Recalculates an account's posted balance directly from all historical transactions
   */
  async recalculateAccountBalance(id: ID): Promise<Paise> {
    const account = await this.uow.accounts.getById(id);
    if (!account) {
      throw new FinanceError(`Account ${id} not found`, "INVALID_ACCOUNT");
    }

    const txns = await this.uow.transactions.query({ accountId: id });
    const computed = computeAccountBalances(account, txns);

    if (account.currentBalancePaise !== computed.postedBalancePaise) {
      await this.uow.accounts.updateBalance(id, computed.postedBalancePaise);
    }

    return computed.postedBalancePaise;
  }
}

