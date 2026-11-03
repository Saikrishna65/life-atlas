/**
 * Life Atlas Finance: Savings Pockets & Goals Application Service
 * 
 * Account-linked Savings Pockets allocate money already held in existing bank
 * or cash accounts. Pockets only earmark money within Atlas; they never claim
 * to transfer money, accept deposits, lock bank funds, or prevent bank spending.
 */

import { IUnitOfWork } from "../storage/interfaces";
import {
  SavingsPocket,
  SavingsGoal,
  PocketHistoryEntry,
  PocketHistoryType,
  PocketStatus,
  SavingsGoalStatus,
  ID,
  Paise,
} from "../domain/models";
import { addPaise, subtractPaise, assertSafePaise, formatPaise } from "../domain/money";
import { FinanceError } from "../domain/errors";

export interface CreateSavingsPocketDTO {
  name: string;
  linkedAccountId?: ID;
  targetAmountPaise?: Paise;
  initialAllocationPaise?: Paise;
  targetDate?: string;
  color?: string;
  icon?: string;
  note?: string;
}

export interface UpdateSavingsPocketDTO {
  name?: string;
  linkedAccountId?: ID;
  targetAmountPaise?: Paise | null;
  targetDate?: string | null;
  color?: string;
  icon?: string;
  status?: PocketStatus | SavingsGoalStatus;
}

export interface CreateSavingsGoalDTO {
  name: string;
  targetAmountPaise: Paise;
  currentAmountPaise?: Paise;
  targetDate?: string;
  linkedAccountId?: ID;
  color?: string;
  icon?: string;
}

export interface GoalProgressView extends SavingsPocket {
  remainingAmountPaise: Paise;
  percentComplete: number;
  daysRemaining?: number;
  isCompleted: boolean;
}

export interface AccountPocketSummary {
  recordedBalancePaise: Paise;
  totalAllocatedPaise: Paise;
  availableBalancePaise: Paise;
  shortfallPaise: Paise;
  activePocketCount: number;
}

export class SavingsGoalService {
  constructor(private uow: IUnitOfWork) {}

  /**
   * Computes recorded balance, pocket allocations, available funds, and shortfall for an account.
   */
  async getAccountPocketSummary(accountId: ID): Promise<AccountPocketSummary> {
    const account = await this.uow.accounts.getById(accountId);
    if (!account) {
      throw new FinanceError(`Account ${accountId} not found`, "INVALID_ACCOUNT");
    }

    const allPockets = await this.uow.savingsGoals.getAll();
    const activePockets = allPockets.filter(
      (p) => p.linkedAccountId === accountId && p.status !== "archived" && !p.isLegacyGoal
    );

    const totalAllocated = activePockets.reduce(
      (sum, p) => addPaise(sum, p.allocatedPaise || 0),
      0
    );

    const recorded = account.currentBalancePaise;
    const available = Math.max(0, subtractPaise(recorded, totalAllocated));
    const shortfall = recorded < totalAllocated ? subtractPaise(totalAllocated, recorded) : 0;

    return {
      recordedBalancePaise: recorded,
      totalAllocatedPaise: totalAllocated,
      availableBalancePaise: available,
      shortfallPaise: shortfall,
      activePocketCount: activePockets.length,
    };
  }

  /**
   * Creates a new account-linked savings pocket.
   */
  async createPocket(dto: CreateSavingsPocketDTO): Promise<SavingsPocket> {
    if (!dto.name || !dto.name.trim()) {
      throw new FinanceError("Pocket name is required", "VALIDATION_FAILED");
    }

    if (dto.targetAmountPaise !== undefined && dto.targetAmountPaise !== null) {
      assertSafePaise(dto.targetAmountPaise, "Target amount");
      if (dto.targetAmountPaise <= 0) {
        throw new FinanceError("Target amount must be strictly positive", "INVALID_AMOUNT");
      }
    }

    let initialAllocation = dto.initialAllocationPaise || 0;
    assertSafePaise(initialAllocation, "Initial allocation");
    if (initialAllocation < 0) {
      throw new FinanceError("Initial allocation cannot be negative", "INVALID_AMOUNT");
    }

    if (dto.linkedAccountId) {
      const account = await this.uow.accounts.getById(dto.linkedAccountId);
      if (!account) {
        throw new FinanceError(`Account ${dto.linkedAccountId} not found`, "INVALID_ACCOUNT");
      }
      if (account.status === "archived") {
        throw new FinanceError(`Cannot link pocket to archived account ${dto.linkedAccountId}`, "ACCOUNT_ARCHIVED");
      }

      if (initialAllocation > 0) {
        const summary = await this.getAccountPocketSummary(account.id);
        if (initialAllocation > summary.availableBalancePaise) {
          throw new FinanceError(
            `Cannot allocate ${formatPaise(initialAllocation)}: only ${formatPaise(summary.availableBalancePaise)} is available in ${account.name}`,
            "INSUFFICIENT_FUNDS"
          );
        }
      }
    } else if (initialAllocation > 0) {
      throw new FinanceError("An account must be chosen to allocate initial funds", "VALIDATION_FAILED");
    }

    const now = new Date().toISOString();
    const id: ID = `pocket_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const history: PocketHistoryEntry[] = [];

    if (initialAllocation > 0) {
      history.push({
        id: `pkh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        pocketId: id,
        type: "allocate",
        amountPaise: initialAllocation,
        balanceAfterPaise: initialAllocation,
        occurredAt: now,
        note: dto.note?.trim() || "Initial set-aside",
      });
    }

    const status: PocketStatus =
      dto.targetAmountPaise && initialAllocation >= dto.targetAmountPaise ? "completed" : "active";

    const pocket: SavingsPocket = {
      id,
      name: dto.name.trim(),
      linkedAccountId: dto.linkedAccountId,
      allocatedPaise: initialAllocation,
      currentAmountPaise: initialAllocation,
      targetAmountPaise: dto.targetAmountPaise,
      targetDate: dto.targetDate,
      color: dto.color || "#10B981",
      icon: dto.icon || "PiggyBank",
      status,
      isLegacyGoal: false,
      history,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await this.uow.savingsGoals.save(pocket);
    return pocket;
  }

  /**
   * Adds money to a pocket ("Set aside") from the linked account's available balance.
   */
  async allocateToPocket(id: ID, amountPaise: Paise, note?: string): Promise<SavingsPocket> {
    assertSafePaise(amountPaise, "Allocation amount");
    if (amountPaise <= 0) {
      throw new FinanceError("Allocation amount must be strictly positive", "INVALID_AMOUNT");
    }

    const pocket = await this.uow.savingsGoals.getById(id);
    if (!pocket) {
      throw new FinanceError(`Pocket ${id} not found`, "VALIDATION_FAILED");
    }

    if (!pocket.linkedAccountId) {
      throw new FinanceError(
        "This pocket must be linked to an account before setting aside money.",
        "ACCOUNT_NOT_LINKED"
      );
    }

    const summary = await this.getAccountPocketSummary(pocket.linkedAccountId);
    if (amountPaise > summary.availableBalancePaise) {
      throw new FinanceError(
        `Cannot allocate ${formatPaise(amountPaise)}: only ${formatPaise(summary.availableBalancePaise)} is available in the account.`,
        "INSUFFICIENT_FUNDS"
      );
    }

    const now = new Date().toISOString();
    const newAllocated = addPaise(pocket.allocatedPaise || 0, amountPaise);

    const historyEntry: PocketHistoryEntry = {
      id: `pkh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      pocketId: pocket.id,
      type: "allocate",
      amountPaise,
      balanceAfterPaise: newAllocated,
      occurredAt: now,
      note: note?.trim(),
    };

    pocket.allocatedPaise = newAllocated;
    pocket.currentAmountPaise = newAllocated;
    pocket.history = [...(pocket.history || []), historyEntry];

    if (pocket.targetAmountPaise && newAllocated >= pocket.targetAmountPaise) {
      pocket.status = "completed";
    }

    pocket.updatedAt = now;
    pocket.version = (pocket.version || 1) + 1;

    await this.uow.savingsGoals.save(pocket);
    return pocket;
  }

  /**
   * Releases money from a pocket back to the account's unallocated amount.
   */
  async releaseFromPocket(id: ID, amountPaise: Paise, note?: string): Promise<SavingsPocket> {
    assertSafePaise(amountPaise, "Release amount");
    if (amountPaise <= 0) {
      throw new FinanceError("Release amount must be strictly positive", "INVALID_AMOUNT");
    }

    const pocket = await this.uow.savingsGoals.getById(id);
    if (!pocket) {
      throw new FinanceError(`Pocket ${id} not found`, "VALIDATION_FAILED");
    }

    if (amountPaise > (pocket.allocatedPaise || 0)) {
      throw new FinanceError(
        `Cannot release ${formatPaise(amountPaise)}: only ${formatPaise(pocket.allocatedPaise || 0)} is currently set aside in this pocket.`,
        "INVALID_AMOUNT"
      );
    }

    const now = new Date().toISOString();
    const newAllocated = subtractPaise(pocket.allocatedPaise || 0, amountPaise);

    const historyEntry: PocketHistoryEntry = {
      id: `pkh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      pocketId: pocket.id,
      type: "release",
      amountPaise,
      balanceAfterPaise: newAllocated,
      occurredAt: now,
      note: note?.trim(),
    };

    pocket.allocatedPaise = newAllocated;
    pocket.currentAmountPaise = newAllocated;
    pocket.history = [...(pocket.history || []), historyEntry];

    if (pocket.targetAmountPaise && newAllocated < pocket.targetAmountPaise && pocket.status === "completed") {
      pocket.status = "active";
    }

    pocket.updatedAt = now;
    pocket.version = (pocket.version || 1) + 1;

    await this.uow.savingsGoals.save(pocket);
    return pocket;
  }

  /**
   * Moves allocations between two pockets linked to the EXACT SAME account.
   * Moving between different accounts requires an actual account transfer first.
   */
  async moveAllocation(
    sourcePocketId: ID,
    targetPocketId: ID,
    amountPaise: Paise,
    note?: string
  ): Promise<{ source: SavingsPocket; target: SavingsPocket }> {
    if (sourcePocketId === targetPocketId) {
      throw new FinanceError("Source and target pockets must be different", "VALIDATION_FAILED");
    }

    assertSafePaise(amountPaise, "Move amount");
    if (amountPaise <= 0) {
      throw new FinanceError("Amount to move must be strictly positive", "INVALID_AMOUNT");
    }

    const [source, target] = await Promise.all([
      this.uow.savingsGoals.getById(sourcePocketId),
      this.uow.savingsGoals.getById(targetPocketId),
    ]);

    if (!source) throw new FinanceError(`Source pocket ${sourcePocketId} not found`, "VALIDATION_FAILED");
    if (!target) throw new FinanceError(`Target pocket ${targetPocketId} not found`, "VALIDATION_FAILED");

    if (!source.linkedAccountId || !target.linkedAccountId || source.linkedAccountId !== target.linkedAccountId) {
      throw new FinanceError(
        "Allocations can only be moved directly between pockets linked to the same account. To move funds between different accounts, record an account transfer first.",
        "ACCOUNT_MISMATCH"
      );
    }

    if (amountPaise > (source.allocatedPaise || 0)) {
      throw new FinanceError(
        `Cannot move ${formatPaise(amountPaise)}: only ${formatPaise(source.allocatedPaise || 0)} is available in ${source.name}.`,
        "INVALID_AMOUNT"
      );
    }

    const now = new Date().toISOString();
    const sourceNewBalance = subtractPaise(source.allocatedPaise || 0, amountPaise);
    const targetNewBalance = addPaise(target.allocatedPaise || 0, amountPaise);

    source.allocatedPaise = sourceNewBalance;
    source.currentAmountPaise = sourceNewBalance;
    source.history = [
      ...(source.history || []),
      {
        id: `pkh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_out`,
        pocketId: source.id,
        type: "move_out",
        amountPaise,
        balanceAfterPaise: sourceNewBalance,
        occurredAt: now,
        relatedPocketId: target.id,
        relatedPocketName: target.name,
        note: note?.trim(),
      },
    ];
    source.updatedAt = now;
    source.version = (source.version || 1) + 1;

    target.allocatedPaise = targetNewBalance;
    target.currentAmountPaise = targetNewBalance;
    target.history = [
      ...(target.history || []),
      {
        id: `pkh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_in`,
        pocketId: target.id,
        type: "move_in",
        amountPaise,
        balanceAfterPaise: targetNewBalance,
        occurredAt: now,
        relatedPocketId: source.id,
        relatedPocketName: source.name,
        note: note?.trim(),
      },
    ];
    if (target.targetAmountPaise && targetNewBalance >= target.targetAmountPaise) {
      target.status = "completed";
    }
    target.updatedAt = now;
    target.version = (target.version || 1) + 1;

    await Promise.all([
      this.uow.savingsGoals.save(source),
      this.uow.savingsGoals.save(target),
    ]);

    return { source, target };
  }

  /**
   * Updates pocket details (name, target, date, color, icon).
   */
  async updatePocket(id: ID, updates: UpdateSavingsPocketDTO): Promise<SavingsPocket> {
    const existing = await this.uow.savingsGoals.getById(id);
    if (!existing) {
      throw new FinanceError(`Pocket ${id} not found`, "VALIDATION_FAILED");
    }

    if (updates.name !== undefined) {
      if (!updates.name.trim()) throw new FinanceError("Pocket name cannot be empty", "VALIDATION_FAILED");
      existing.name = updates.name.trim();
    }

    if (updates.targetAmountPaise !== undefined) {
      if (updates.targetAmountPaise === null || updates.targetAmountPaise === 0) {
        existing.targetAmountPaise = undefined;
      } else {
        assertSafePaise(updates.targetAmountPaise, "Target amount");
        if (updates.targetAmountPaise <= 0) throw new FinanceError("Target amount must be positive", "INVALID_AMOUNT");
        existing.targetAmountPaise = updates.targetAmountPaise;
      }
    }

    if (updates.linkedAccountId !== undefined && updates.linkedAccountId !== existing.linkedAccountId) {
      if ((existing.allocatedPaise || 0) > 0) {
        throw new FinanceError(
          "Cannot re-link a pocket with an active allocation. Release or reallocate its funds first.",
          "POCKET_NOT_EMPTY"
        );
      }
      existing.linkedAccountId = updates.linkedAccountId;
    }

    if (updates.targetDate !== undefined) existing.targetDate = updates.targetDate || undefined;
    if (updates.color !== undefined) existing.color = updates.color;
    if (updates.icon !== undefined) existing.icon = updates.icon;
    if (updates.status !== undefined) existing.status = updates.status;

    existing.updatedAt = new Date().toISOString();
    existing.version = (existing.version || 1) + 1;

    await this.uow.savingsGoals.save(existing);
    return existing;
  }

  /**
   * Safely deletes a pocket. Strictly requires releasing or reallocating all funds first!
   */
  async deletePocket(id: ID): Promise<void> {
    const existing = await this.uow.savingsGoals.getById(id);
    if (!existing) return;

    if ((existing.allocatedPaise || 0) > 0) {
      throw new FinanceError(
        `Cannot delete pocket: release or reallocate the remaining ${formatPaise(existing.allocatedPaise || 0)} first.`,
        "POCKET_NOT_EMPTY"
      );
    }

    await this.uow.savingsGoals.delete(id);
  }

  /**
   * Archives a pocket.
   */
  async archivePocket(id: ID): Promise<SavingsPocket> {
    return this.updatePocket(id, { status: "archived" });
  }

  /**
   * Restores an archived pocket.
   */
  async unarchivePocket(id: ID): Promise<SavingsPocket> {
    return this.updatePocket(id, { status: "active" });
  }

  /**
   * Migrates a legacy goal to an account-linked pocket upon explicit user confirmation.
   */
  async migrateLegacyGoal(
    id: ID,
    accountId: ID,
    allocatedPaise: Paise,
    note?: string
  ): Promise<SavingsPocket> {
    const existing = await this.uow.savingsGoals.getById(id);
    if (!existing) {
      throw new FinanceError(`Goal ${id} not found`, "VALIDATION_FAILED");
    }

    const account = await this.uow.accounts.getById(accountId);
    if (!account || account.status === "archived") {
      throw new FinanceError("Choose an active account to link this pocket.", "INVALID_ACCOUNT");
    }

    assertSafePaise(allocatedPaise, "Allocated amount");
    if (allocatedPaise > 0) {
      const summary = await this.getAccountPocketSummary(account.id);
      if (allocatedPaise > summary.availableBalancePaise) {
        throw new FinanceError(
          `Cannot allocate ${formatPaise(allocatedPaise)}: only ${formatPaise(summary.availableBalancePaise)} is available in ${account.name}.`,
          "INSUFFICIENT_FUNDS"
        );
      }
    }

    const now = new Date().toISOString();
    existing.linkedAccountId = accountId;
    existing.allocatedPaise = allocatedPaise;
    existing.currentAmountPaise = allocatedPaise;
    existing.isLegacyGoal = false;

    if (allocatedPaise > 0) {
      existing.history = [
        ...(existing.history || []),
        {
          id: `pkh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          pocketId: existing.id,
          type: "legacy_import",
          amountPaise: allocatedPaise,
          balanceAfterPaise: allocatedPaise,
          occurredAt: now,
          note: note?.trim() || `Allocated from legacy goal progress (${formatPaise(existing.legacyTrackedPaise || 0)})`,
        },
      ];
    }

    existing.updatedAt = now;
    existing.version = (existing.version || 1) + 1;

    await this.uow.savingsGoals.save(existing);
    return existing;
  }

  /**
   * Deducts an expense from a pocket's allocation atomically when spent.
   */
  async recordPocketExpense(
    pocketId: ID,
    amountPaise: Paise,
    transactionId?: ID,
    description?: string
  ): Promise<{ pocket: SavingsPocket; deductionPaise: Paise }> {
    const pocket = await this.uow.savingsGoals.getById(pocketId);
    if (!pocket) {
      throw new FinanceError(`Pocket ${pocketId} not found`, "VALIDATION_FAILED");
    }

    const deductionPaise = Math.min(pocket.allocatedPaise || 0, amountPaise);
    if (deductionPaise <= 0) {
      return { pocket, deductionPaise: 0 };
    }

    const now = new Date().toISOString();
    const newAllocated = subtractPaise(pocket.allocatedPaise || 0, deductionPaise);

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
        occurredAt: now,
        note: description ? `Spent on: ${description}` : "Pocket expense",
        transactionId,
      },
    ];
    pocket.updatedAt = now;
    pocket.version = (pocket.version || 1) + 1;

    await this.uow.savingsGoals.save(pocket);
    return { pocket, deductionPaise };
  }

  /**
   * Restores pocket allocation when a pocket-linked expense is reversed or deleted.
   */
  async restorePocketExpense(
    pocketId: ID,
    amountPaise: Paise,
    transactionId?: ID,
    reason?: string
  ): Promise<SavingsPocket> {
    const pocket = await this.uow.savingsGoals.getById(pocketId);
    if (!pocket) {
      throw new FinanceError(`Pocket ${pocketId} not found`, "VALIDATION_FAILED");
    }

    if (amountPaise <= 0) return pocket;

    const now = new Date().toISOString();
    const newAllocated = addPaise(pocket.allocatedPaise || 0, amountPaise);

    pocket.allocatedPaise = newAllocated;
    pocket.currentAmountPaise = newAllocated;
    pocket.history = [
      ...(pocket.history || []),
      {
        id: `pkh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        pocketId: pocket.id,
        type: "refund",
        amountPaise,
        balanceAfterPaise: newAllocated,
        occurredAt: now,
        note: reason || "Restored from reversed/deleted transaction",
        transactionId,
      },
    ];
    pocket.updatedAt = now;
    pocket.version = (pocket.version || 1) + 1;

    await this.uow.savingsGoals.save(pocket);
    return pocket;
  }

  // ===========================================================================
  // Backwards-Compatible API for existing callers & tests
  // ===========================================================================

  async createGoal(dto: CreateSavingsGoalDTO): Promise<SavingsGoal> {
    if (!dto.name || !dto.name.trim()) {
      throw new FinanceError("Goal name is required", "VALIDATION_FAILED");
    }
    assertSafePaise(dto.targetAmountPaise, "Target amount");
    if (dto.targetAmountPaise <= 0) {
      throw new FinanceError("Target amount must be strictly positive", "INVALID_AMOUNT");
    }
    const current = dto.currentAmountPaise || 0;
    assertSafePaise(current, "Current amount");
    if (current < 0) {
      throw new FinanceError("Current amount cannot be negative", "INVALID_AMOUNT");
    }

    const now = new Date().toISOString();
    const id: ID = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const status: SavingsGoalStatus = current >= dto.targetAmountPaise ? "reached" : "in_progress";

    const goal: SavingsPocket = {
      id,
      name: dto.name.trim(),
      targetAmountPaise: dto.targetAmountPaise,
      allocatedPaise: dto.linkedAccountId ? current : 0,
      currentAmountPaise: current,
      legacyTrackedPaise: dto.linkedAccountId ? undefined : current,
      isLegacyGoal: !dto.linkedAccountId,
      targetDate: dto.targetDate,
      linkedAccountId: dto.linkedAccountId,
      color: dto.color || "#10B981",
      icon: dto.icon || "Target",
      status,
      history: [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await this.uow.savingsGoals.save(goal);
    return goal;
  }

  async updateGoal(id: ID, updates: Partial<CreateSavingsGoalDTO & { status: SavingsGoalStatus }>): Promise<SavingsGoal> {
    const existing = await this.uow.savingsGoals.getById(id);
    if (!existing) {
      throw new FinanceError(`Savings goal ${id} not found`, "VALIDATION_FAILED");
    }

    if (updates.name !== undefined) {
      if (!updates.name.trim()) throw new FinanceError("Goal name cannot be empty", "VALIDATION_FAILED");
      existing.name = updates.name.trim();
    }

    if (updates.targetAmountPaise !== undefined) {
      assertSafePaise(updates.targetAmountPaise, "Target amount");
      if (updates.targetAmountPaise <= 0) throw new FinanceError("Target amount must be positive", "INVALID_AMOUNT");
      existing.targetAmountPaise = updates.targetAmountPaise;
    }

    if (updates.currentAmountPaise !== undefined) {
      assertSafePaise(updates.currentAmountPaise, "Current amount");
      if (updates.currentAmountPaise < 0) throw new FinanceError("Current amount cannot be negative", "INVALID_AMOUNT");
      existing.currentAmountPaise = updates.currentAmountPaise;
      if (existing.linkedAccountId) existing.allocatedPaise = updates.currentAmountPaise;
      else existing.legacyTrackedPaise = updates.currentAmountPaise;
    }

    if (updates.targetDate !== undefined) existing.targetDate = updates.targetDate;
    if (updates.linkedAccountId !== undefined) existing.linkedAccountId = updates.linkedAccountId;
    if (updates.color !== undefined) existing.color = updates.color;
    if (updates.icon !== undefined) existing.icon = updates.icon;
    if (updates.status !== undefined) existing.status = updates.status;

    if (existing.targetAmountPaise && existing.currentAmountPaise >= existing.targetAmountPaise && existing.status === "in_progress") {
      existing.status = "reached";
    }

    existing.updatedAt = new Date().toISOString();
    existing.version = (existing.version || 1) + 1;

    await this.uow.savingsGoals.save(existing);
    return existing;
  }

  async recordContribution(id: ID, amountPaise: Paise): Promise<SavingsGoal> {
    assertSafePaise(amountPaise, "Contribution amount");
    if (amountPaise <= 0) {
      throw new FinanceError("Contribution amount must be positive", "INVALID_AMOUNT");
    }

    const existing = await this.uow.savingsGoals.getById(id);
    if (!existing) {
      throw new FinanceError(`Savings goal ${id} not found`, "VALIDATION_FAILED");
    }

    if (existing.linkedAccountId && !existing.isLegacyGoal) {
      return this.allocateToPocket(id, amountPaise);
    }

    existing.currentAmountPaise = addPaise(existing.currentAmountPaise, amountPaise);
    if (existing.isLegacyGoal) existing.legacyTrackedPaise = existing.currentAmountPaise;
    if (existing.targetAmountPaise && existing.currentAmountPaise >= existing.targetAmountPaise) {
      existing.status = "reached";
    }
    existing.updatedAt = new Date().toISOString();
    existing.version = (existing.version || 1) + 1;

    await this.uow.savingsGoals.save(existing);
    return existing;
  }

  async deleteGoal(id: ID): Promise<void> {
    const existing = await this.uow.savingsGoals.getById(id);
    if (existing && (existing.allocatedPaise || 0) > 0) {
      throw new FinanceError(
        `Cannot delete pocket: release or reallocate the remaining ${formatPaise(existing.allocatedPaise || 0)} first.`,
        "POCKET_NOT_EMPTY"
      );
    }
    await this.uow.savingsGoals.delete(id);
  }

  async getGoalsWithProgress(): Promise<GoalProgressView[]> {
    const goals = await this.uow.savingsGoals.getAll();
    const now = Date.now();

    return goals.map((g) => {
      const current = (g.allocatedPaise && g.allocatedPaise > 0) ? g.allocatedPaise : (g.currentAmountPaise || 0);
      const target = g.targetAmountPaise || 0;
      const remaining = target > 0 ? Math.max(0, subtractPaise(target, current)) : 0;
      const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

      let daysRemaining: number | undefined;
      if (g.targetDate) {
        const diffMs = Date.parse(g.targetDate) - now;
        daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      return {
        ...g,
        currentAmountPaise: current,
        remainingAmountPaise: remaining,
        percentComplete: percent,
        daysRemaining,
        isCompleted: g.status === "reached" || g.status === "completed" || (target > 0 && current >= target),
      };
    });
  }
}
