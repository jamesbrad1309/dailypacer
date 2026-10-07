import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { SavingsGoal } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { AccountsService } from "#finance/accounts.service";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import { CurrenciesService } from "#finance/currencies.service";
import { currencyDigits } from "#finance/currency-math.util";
import type {
  ContributeInput,
  CreateSavingsGoalInput,
  UpdateSavingsGoalInput,
} from "#finance/dto/savings-goal.dto";
import { FinanceHabitsService } from "#finance/finance-habits.service";
import { SAVINGS_GOAL } from "#finance/finance-habits.util";
import { type GoalProgress, goalProgress } from "#finance/savings-goal.util";
import { HabitsService } from "#habits/habits.service";

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
    /** The daily habit's amount, in minor units; null when there's none (or it's stopped). */
    dailyHabitMinor: number | null;
  };

/** What a goal read brings with it. */
const GOAL_INCLUDE = {
  account: { select: { name: true } },
  habit: { select: { targetValue: true, archivedAt: true } },
} as const;
type GoalWithLinks = SavingsGoal & {
  account: { name: string } | null;
  habit: { targetValue: number | null; archivedAt: Date | null } | null;
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
    private readonly habits: HabitsService,
    private readonly financeHabits: FinanceHabitsService,
  ) {}

  async list(today: string, includeArchived = false): Promise<SavingsGoalDto[]> {
    const goals = await this.prisma.savingsGoal.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }],
      include: GOAL_INCLUDE,
    });
    const saved = await this.savedAmounts(goals, today);
    return goals.map((goal) => this.toDto(goal, saved, today));
  }

  async findOne(id: string, today: string): Promise<SavingsGoalDto> {
    const goal = await this.prisma.savingsGoal.findUnique({ where: { id }, include: GOAL_INCLUDE });
    if (!goal) throw new NotFoundException(`Savings goal ${id} not found`);
    const saved = await this.savedAmounts([goal], today);
    return this.toDto(goal, saved, today);
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
    if (input.dailyHabitMinor) await this.setDailyHabit(goal, input.dailyHabitMinor);
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
    const updated = await this.prisma.savingsGoal.update({ where: { id }, data });
    if (input.dailyHabitMinor !== undefined) {
      await this.setDailyHabit(updated, input.dailyHabitMinor);
    } else if (updated.habitId && data.accountId !== undefined) {
      // Following another account (or none) changes what each day saved.
      await this.financeHabits.recompute(updated.habitId);
    }
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
    await this.prisma.$transaction([
      this.prisma.savingsGoal.update({
        where: { id },
        data: { savedMinor: { increment: input.amountMinor } },
      }),
      // Dated, so the goal's daily habit can count it.
      this.prisma.savingsContribution.create({
        data: { goalId: id, date: fromIsoDate(input.today), amountMinor: input.amountMinor },
      }),
    ]);
    log.info({ goalId: id, amountMinor: input.amountMinor }, "savings goal contribution");
    await this.financeHabits.syncDays([input.today]);
    return this.findOne(id, input.today);
  }

  /** Its daily habit is archived with it: with no goal, nothing would tick it. */
  async remove(id: string): Promise<{ id: string }> {
    const goal = await this.goal(id);
    await this.prisma.savingsGoal.delete({ where: { id } });
    if (goal.habitId) await this.habits.archive(goal.habitId);
    log.info({ goalId: id }, "savings goal deleted");
    return { id };
  }

  /**
   * Starts, changes or stops the goal's daily "save X" habit: an ordinary
   * habit whose check-ins finance writes (FinanceHabitsService), with the
   * daily amount as its target in major units. Stopping archives it, so
   * its streak history stays, and starting again brings it back.
   */
  private async setDailyHabit(goal: SavingsGoal, dailyMinor: number | null): Promise<void> {
    const habit = goal.habitId ? await this.habits.findOneOrFail(goal.habitId) : null;
    if (dailyMinor === null) {
      if (habit && !habit.archivedAt) await this.habits.archive(habit.id);
      return;
    }
    const targetValue = dailyMinor / 10 ** currencyDigits(goal.currency);
    let habitId = habit?.id;
    if (habit) {
      if (habit.archivedAt) await this.habits.unarchive(habit.id);
      await this.habits.update(habit.id, { targetValue, unit: goal.currency });
    } else {
      const created = await this.habits.create({
        name: goal.name,
        icon: goal.emoji ?? undefined,
        unit: goal.currency,
        targetValue,
        schedule: { type: "daily" },
        tags: ["money"],
        metadata: { source: SAVINGS_GOAL, goalId: goal.id },
      });
      habitId = created.id;
      await this.prisma.savingsGoal.update({ where: { id: goal.id }, data: { habitId } });
    }
    if (habitId) await this.financeHabits.recompute(habitId);
    log.info({ goalId: goal.id, habitId, dailyMinor }, "savings goal daily habit set");
  }

  private toDto(goal: GoalWithLinks, saved: Map<string, number>, today: string): SavingsGoalDto {
    const {
      deadline,
      startDate,
      savedMinor: _own,
      startSavedMinor,
      account,
      habit,
      ...rest
    } = goal;
    const habitActive = habit && !habit.archivedAt && habit.targetValue !== null;
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
      accountName: account?.name ?? null,
      dailyHabitMinor: habitActive
        ? Math.round((habit.targetValue ?? 0) * 10 ** currencyDigits(goal.currency))
        : null,
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
