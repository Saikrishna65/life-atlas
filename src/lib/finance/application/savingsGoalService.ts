/**
 * Life Atlas Finance: Savings Goals Application Service
 * 
 * Manages savings goal tracking, progress updates, and completion status.
 * NOTE: Contributions are explicitly manually tracked and do not double-count as account transfers or expenses.
 */

import { IUnitOfWork } from "../storage/interfaces";
import { SavingsGoal, ID, Paise, SavingsGoalStatus } from "../domain/models";
import { addPaise, subtractPaise, assertSafePaise } from "../domain/money";
import { FinanceError } from "../domain/errors";

export interface CreateSavingsGoalDTO {
  name: string;
  targetAmountPaise: Paise;
  currentAmountPaise?: Paise;
  targetDate?: string;
  linkedAccountId?: ID;
  color?: string;
  icon?: string;
}

export interface GoalProgressView extends SavingsGoal {
  remainingAmountPaise: Paise;
  percentComplete: number;
  daysRemaining?: number;
  isCompleted: boolean;
}

export class SavingsGoalService {
  constructor(private uow: IUnitOfWork) {}

  async createGoal(dto: CreateSavingsGoalDTO): Promise<SavingsGoal> {
    if (!dto.name || !dto.name.trim()) {
      throw new FinanceError("Goal name is required", "VALIDATION_FAILED");
    }

    assertSafePaise(dto.targetAmountPaise, "Target amount");
    if (dto.targetAmountPaise <= 0) {
      throw new FinanceError("Target amount must be strictly positive", "INVALID_AMOUNT");
    }

    const currentAmount = dto.currentAmountPaise || 0;
    assertSafePaise(currentAmount, "Current amount");
    if (currentAmount < 0) {
      throw new FinanceError("Current amount cannot be negative", "INVALID_AMOUNT");
    }

    const now = new Date().toISOString();
    const id: ID = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const status: SavingsGoalStatus = currentAmount >= dto.targetAmountPaise ? "reached" : "in_progress";

    const goal: SavingsGoal = {
      id,
      name: dto.name.trim(),
      targetAmountPaise: dto.targetAmountPaise,
      currentAmountPaise: currentAmount,
      targetDate: dto.targetDate,
      linkedAccountId: dto.linkedAccountId,
      color: dto.color || "#10B981",
      icon: dto.icon || "Target",
      status,
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
    }

    if (updates.targetDate !== undefined) existing.targetDate = updates.targetDate;
    if (updates.linkedAccountId !== undefined) existing.linkedAccountId = updates.linkedAccountId;
    if (updates.color !== undefined) existing.color = updates.color;
    if (updates.icon !== undefined) existing.icon = updates.icon;
    if (updates.status !== undefined) existing.status = updates.status;

    // Auto-update status if reached
    if (existing.currentAmountPaise >= existing.targetAmountPaise && existing.status === "in_progress") {
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

    existing.currentAmountPaise = addPaise(existing.currentAmountPaise, amountPaise);
    if (existing.currentAmountPaise >= existing.targetAmountPaise) {
      existing.status = "reached";
    }
    existing.updatedAt = new Date().toISOString();
    existing.version = (existing.version || 1) + 1;

    await this.uow.savingsGoals.save(existing);
    return existing;
  }

  async deleteGoal(id: ID): Promise<void> {
    await this.uow.savingsGoals.delete(id);
  }

  async getGoalsWithProgress(): Promise<GoalProgressView[]> {
    const goals = await this.uow.savingsGoals.getAll();
    const now = Date.now();

    return goals.map((g) => {
      const remaining = Math.max(0, subtractPaise(g.targetAmountPaise, g.currentAmountPaise));
      const percent =
        g.targetAmountPaise > 0
          ? Math.min(100, Math.round((g.currentAmountPaise / g.targetAmountPaise) * 100))
          : 0;

      let daysRemaining: number | undefined;
      if (g.targetDate) {
        const diffMs = Date.parse(g.targetDate) - now;
        daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      return {
        ...g,
        remainingAmountPaise: remaining,
        percentComplete: percent,
        daysRemaining,
        isCompleted: g.status === "reached" || g.currentAmountPaise >= g.targetAmountPaise,
      };
    });
  }
}

