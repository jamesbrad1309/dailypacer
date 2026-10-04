import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { SavingsGoal } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { AccountsService } from "#finance/accounts.service";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import { CurrenciesService } from "#finance/currencies.service";
import type {
  ContributeInput,
  CreateSavingsGoalInput,
  UpdateSavingsGoalInput,
} from "#finance/dto/savings-goal.dto";
import { type GoalProgress, goalProgress } from "#finance/savings-goal.util";

const log = scopedLogger("SavingsGoalsService");

export type SavingsGoalDto = Omit<
  SavingsGoal,
  "deadline" | "startDate" | "savedMinor" | "startSavedMinor"
> &
  GoalProgress & {
    deadline: string | null;
    startDate: string;
    /** The linked account's name, for "in Marcus Savings". */
    accountName: string | null;
  };

/**
 * Savings goals. A linked goal's saved amount is its account's balance (never
 * below zero), so it moves with every transfer in; an unlinked one keeps
 * its own `savedMinor`, changed through `contribute`. Progress is derived
 * on every read (savings-goal.util.ts).
 */
@Injectable()
export class SavingsGoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
    private readonly currencies: CurrenciesService,
  ) {}

  async list(today: string, includeArchived = false): Promise<SavingsGoalDto[]> {
    const goals = await this.prisma.savingsGoal.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }],
      include: { account: { select: { name: true } } },
    });
    const saved = await this.savedAmounts(goals, today);
    return goals.map((goal) => this.toDto(goal, goal.account?.name ?? null, saved, today));
  }

  async findOne(id: string, today: string): Promise<SavingsGoalDto> {
    const goal = await this.prisma.savingsGoal.findUnique({
      where: { id },
      include: { account: { select: { name: true } } },
    });
    if (!goal) throw new NotFoundException(`Savings goal ${id} not found`);
    const saved = await this.savedAmounts([goal], today);
    return this.toDto(goal, goal.account?.name ?? null, saved, today);
  }

  async create(input: CreateSavingsGoalInput): Promise<SavingsGoalDto> {
    const account = input.accountId ? await this.account(input.accountId) : null;
    if (account && input.savedMinor !== undefined) {
      throw new BadRequestException("A linked goal's saved amount is its account's balance");
    }
    const startSavedMinor = account
      ? await this.balanceOf(account.id, input.today)
      : (input.savedMinor ?? 0);
    const last = await this.prisma.savingsGoal.aggregate({ _max: { sortOrder: true } });
    const goal = await this.prisma.savingsGoal.create({
      data: {
        name: input.name,
        emoji: input.emoji ?? null,
        targetMinor: input.targetMinor,
        currency: account?.currency ?? (await this.currencies.mainCode()),
        deadline: input.deadline ? fromIsoDate(input.deadline) : null,
        accountId: account?.id ?? null,
        savedMinor: account ? 0 : startSavedMinor,
        startDate: fromIsoDate(input.today),
        startSavedMinor,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
    });
    log.info({ goalId: goal.id, linked: Boolean(account) }, "savings goal created");
    return this.findOne(goal.id, input.today);
  }

  /**
   * Linking another account takes its currency; unlinking keeps what the
   * account held as the goal's own saved amount, so progress doesn't vanish.
   */
  async update(id: string, input: UpdateSavingsGoalInput): Promise<SavingsGoalDto> {
    const goal = await this.goal(id);
    const data: Parameters<typeof this.prisma.savingsGoal.update>[0]["data"] = {
      name: input.name,
      emoji: input.emoji,
      targetMinor: input.targetMinor,
    };
    if (input.deadline !== undefined) {
      data.deadline = input.deadline ? fromIsoDate(input.deadline) : null;
    }
    if (input.archived !== undefined) data.archivedAt = input.archived ? new Date() : null;
    if (input.accountId !== undefined && input.accountId !== goal.accountId) {
      if (input.accountId) {
        const account = await this.account(input.accountId);
        data.accountId = account.id;
        data.currency = account.currency;
      } else {
        data.accountId = null;
        data.savedMinor = goal.accountId ? await this.balanceOf(goal.accountId, input.today) : 0;
      }
    }
    await this.prisma.savingsGoal.update({ where: { id }, data });
    return this.findOne(id, input.today);
  }

  /** Adds to (or takes from) an unlinked goal; it can't go below zero. */
  async contribute(id: string, input: ContributeInput): Promise<SavingsGoalDto> {
    const goal = await this.goal(id);
    if (goal.accountId) {
      throw new BadRequestException(
        "This goal follows its account's balance: transfer money into the account instead",
      );
    }
    if (goal.savedMinor + input.amountMinor < 0) {
      throw new BadRequestException("That would take the goal below zero");
    }
    await this.prisma.savingsGoal.update({
      where: { id },
      data: { savedMinor: { increment: input.amountMinor } },
    });
    log.info({ goalId: id, amountMinor: input.amountMinor }, "savings goal contribution");
    return this.findOne(id, input.today);
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.goal(id);
    await this.prisma.savingsGoal.delete({ where: { id } });
    log.info({ goalId: id }, "savings goal deleted");
    return { id };
  }

  private toDto(
    goal: SavingsGoal,
    accountName: string | null,
    saved: Map<string, number>,
    today: string,
  ): SavingsGoalDto {
    const { deadline, startDate, savedMinor: _own, startSavedMinor, ...rest } = goal;
    const shape = {
      targetMinor: goal.targetMinor,
      deadline: deadline ? toIsoDate(deadline) : null,
      startDate: toIsoDate(startDate),
      startSavedMinor,
    };
    return {
      ...rest,
      ...goalProgress(shape, saved.get(goal.id) ?? 0, today),
      deadline: shape.deadline,
      startDate: shape.startDate,
      accountName,
    };
  }

  /** Saved per goal id: the account's balance (not below 0) when linked, else its own amount. */
  private async savedAmounts(goals: SavingsGoal[], today: string): Promise<Map<string, number>> {
    const accountIds = [...new Set(goals.flatMap((g) => (g.accountId ? [g.accountId] : [])))];
    const metrics =
      accountIds.length > 0 ? await this.accounts.metrics(accountIds, fromIsoDate(today)) : [];
    const balance = new Map(metrics.map((m) => [m.accountId, Math.max(0, m.balanceMinor)]));
    return new Map(
      goals.map((g) => [g.id, g.accountId ? (balance.get(g.accountId) ?? 0) : g.savedMinor]),
    );
  }

  private async balanceOf(accountId: string, today: string): Promise<number> {
    const [metrics] = await this.accounts.metrics([accountId], fromIsoDate(today));
    return Math.max(0, metrics?.balanceMinor ?? 0);
  }

  private async account(id: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account || account.archivedAt) {
      throw new BadRequestException("accountId must be an active account");
    }
    return account;
  }

  private async goal(id: string): Promise<SavingsGoal> {
    const goal = await this.prisma.savingsGoal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundException(`Savings goal ${id} not found`);
    return goal;
  }
}
