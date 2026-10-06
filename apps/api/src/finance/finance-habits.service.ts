import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Habit, HabitEntry, SavingsGoal } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import { currencyDigits } from "#finance/currency-math.util";
import {
  type DayTransaction,
  FINANCE_HABIT_SOURCES,
  type FinanceHabitLink,
  LOGGED_TODAY,
  SAVINGS_GOAL,
  derivedEntry,
  financeLinkOf,
  savedEntry,
  savedOnDay,
} from "#finance/finance-habits.util";
import { HabitEntriesService } from "#habit-entries/habit-entries.service";

const log = scopedLogger("FinanceHabitsService");

/** A savings habit always comes with its goal; a habit whose goal is gone is left alone. */
type LinkedHabit = Habit & { link: FinanceHabitLink; goal?: SavingsGoal };

/** One day's rows for every linked habit. */
interface DayRows {
  transactions: (DayTransaction & { accountId: string })[];
  /** Per goal id. */
  contributions: Map<string, { amountMinor: number }[]>;
}

/** A day as a transaction or entry date, or "YYYY-MM-DD". */
type DayLike = Date | string;

const isoDay = (day: DayLike) => (typeof day === "string" ? day : toIsoDate(day));

/**
 * The first day a linked habit gets entries: the day before its creation
 * day, since `createdAt` is an instant and the user's day may start before
 * UTC's. Nothing earlier, or an old transaction's entry would move the
 * habit's tracking start back (trackedSince) and hand out clean days.
 */
const firstDay = (habit: Habit) =>
  toIsoDate(new Date(fromIsoDate(toIsoDate(habit.createdAt)).getTime() - 86_400_000));

/**
 * Keeps the habits linked to finance (finance-habits.util.ts) in step with
 * the transactions: after any write, the days it touched are worked out
 * again and written as ordinary habit entries, so streaks, points and
 * heatmaps need no changes. Finance depends on habit entries, never the
 * other way round.
 */
@Injectable()
export class FinanceHabitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entries: HabitEntriesService,
  ) {}

  /**
   * Called after a transaction write has committed, with every day it
   * touched (both, when a date changed). Never throws: a finance write
   * mustn't fail over a habit, and `recompute` can repair one later.
   */
  async syncDays(days: Iterable<DayLike>): Promise<void> {
    try {
      const unique = [...new Set([...days].map(isoDay))];
      if (unique.length === 0) return;
      const habits = await this.linkedHabits();
      if (habits.length > 0) await this.sync(habits, unique);
    } catch (err) {
      log.error({ err }, "finance-linked habit sync failed");
    }
  }

  /**
   * A reconcile on `date`: the log-today habit counts it even when the
   * balance was already right and no adjustment was recorded.
   */
  async markReconciled(date: string): Promise<void> {
    try {
      const habits = (await this.linkedHabits()).filter((h) => h.link.source === LOGGED_TODAY);
      if (habits.length > 0) await this.sync(habits, [date], date);
    } catch (err) {
      log.error({ err, date }, "finance-linked habit sync failed after reconcile");
    }
  }

  /**
   * Rebuilds one linked habit's entries from its first day on: after an
   * import, a bug fix, or when the habit is first created.
   */
  async recompute(habitId: string): Promise<{ days: number }> {
    const habit = await this.prisma.habit.findUnique({
      where: { id: habitId },
      include: { savingsGoal: true },
    });
    if (!habit) throw new NotFoundException(`Habit ${habitId} not found`);
    const link = financeLinkOf(habit.metadata);
    if (!link) throw new BadRequestException(`${habit.name} isn't linked to finance`);
    const { savingsGoal: goal, ...plain } = habit;
    if (link.source === SAVINGS_GOAL && !goal) {
      throw new BadRequestException(`${habit.name} isn't linked to a savings goal`);
    }

    const since = fromIsoDate(firstDay(habit));
    const [transactionDays, entryDays, contributionDays] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { date: { gte: since } },
        select: { date: true },
        distinct: ["date"],
      }),
      this.prisma.habitEntry.findMany({ where: { habitId }, select: { date: true } }),
      goal
        ? this.prisma.savingsContribution.findMany({
            where: { goalId: goal.id, date: { gte: since } },
            select: { date: true },
            distinct: ["date"],
          })
        : [],
    ]);
    const days = [
      ...new Set(
        [...transactionDays, ...entryDays, ...contributionDays].map((d) => isoDay(d.date)),
      ),
    ];
    if (days.length > 0) await this.sync([{ ...plain, link, goal: goal ?? undefined }], days);
    log.info({ habitId, days: days.length }, "finance-linked habit recomputed");
    return { days: days.length };
  }

  private async linkedHabits(): Promise<LinkedHabit[]> {
    const habits = await this.prisma.habit.findMany({
      where: {
        archivedAt: null,
        OR: FINANCE_HABIT_SOURCES.map((source) => ({
          metadata: { path: ["source"], equals: source },
        })),
      },
      include: { savingsGoal: true },
    });
    return habits.flatMap(({ savingsGoal: goal, ...habit }) => {
      const link = financeLinkOf(habit.metadata);
      if (!link || (link.source === SAVINGS_GOAL && !goal)) return [];
      return [{ ...habit, link, goal: goal ?? undefined }];
    });
  }

  /** Writes each habit's entry for each day, skipping ones that are already right. */
  private async sync(habits: LinkedHabit[], days: string[], reconciledOn?: string) {
    const dates = days.map(fromIsoDate);
    const goalIds = habits.flatMap((h) => (h.goal ? [h.goal.id] : []));
    const [transactions, stored, contributions] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { date: { in: dates } },
        select: {
          date: true,
          accountId: true,
          amountMinor: true,
          source: true,
          transferId: true,
          categoryId: true,
          splits: { select: { categoryId: true } },
        },
      }),
      this.prisma.habitEntry.findMany({
        where: { habitId: { in: habits.map((h) => h.id) }, date: { in: dates } },
      }),
      goalIds.length > 0
        ? this.prisma.savingsContribution.findMany({
            where: { goalId: { in: goalIds }, date: { in: dates } },
          })
        : [],
    ]);
    const byDay = new Map<string, DayRows>(
      days.map((day) => [day, { transactions: [], contributions: new Map() }]),
    );
    for (const t of transactions) byDay.get(isoDay(t.date))?.transactions.push(t);
    for (const c of contributions) {
      const rows = byDay.get(isoDay(c.date))?.contributions;
      rows?.set(c.goalId, [...(rows.get(c.goalId) ?? []), c]);
    }
    const entryFor = new Map(stored.map((e) => [`${e.habitId}:${isoDay(e.date)}`, e]));

    for (const habit of habits) {
      for (const day of days) {
        const rows = byDay.get(day) ?? { transactions: [], contributions: new Map() };
        await this.write(habit, day, rows, entryFor.get(`${habit.id}:${day}`), {
          reconciled: day === reconciledOn,
        });
      }
    }
  }

  private async write(
    habit: LinkedHabit,
    date: string,
    { transactions, contributions }: DayRows,
    existing: HabitEntry | undefined,
    { reconciled }: { reconciled: boolean },
  ) {
    if (date < firstDay(habit)) return;
    if (habit.goal) {
      const savedMinor = savedOnDay(
        habit.goal,
        transactions,
        contributions.get(habit.goal.id) ?? [],
      );
      const want = savedEntry(savedMinor, currencyDigits(habit.goal.currency), habit.targetValue);
      const same =
        (existing?.value ?? 0) === want.value && (existing?.completed ?? false) === want.completed;
      if (same) return;
      await this.entries.upsert({
        habitId: habit.id,
        date,
        ...want,
        metadata: { source: habit.link.source },
      });
      return;
    }
    const wasReconciled = (existing?.metadata as { reconciled?: unknown })?.reconciled === true;
    const want = derivedEntry(habit.link, transactions, reconciled || wasReconciled);
    const metadata = { source: habit.link.source, ...(reconciled && { reconciled: true }) };

    if (want.kind === "slips") {
      if ((existing?.value ?? 0) === want.value && !existing?.completed) return;
      await this.entries.upsert({
        habitId: habit.id,
        date,
        completed: false,
        value: want.value,
        metadata,
      });
      return;
    }
    if ((existing?.completed ?? false) === want.completed && (!reconciled || wasReconciled)) return;
    await this.entries.upsert({ habitId: habit.id, date, completed: want.completed, metadata });
  }
}
