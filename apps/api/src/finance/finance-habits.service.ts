import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Habit, HabitEntry } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import {
  type DayTransaction,
  FINANCE_HABIT_SOURCES,
  type FinanceHabitLink,
  LOGGED_TODAY,
  derivedEntry,
  financeLinkOf,
} from "#finance/finance-habits.util";
import { HabitEntriesService } from "#habit-entries/habit-entries.service";

const log = scopedLogger("FinanceHabitsService");

type LinkedHabit = Habit & { link: FinanceHabitLink };

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
    const habit = await this.prisma.habit.findUnique({ where: { id: habitId } });
    if (!habit) throw new NotFoundException(`Habit ${habitId} not found`);
    const link = financeLinkOf(habit.metadata);
    if (!link) throw new BadRequestException(`${habit.name} isn't linked to finance`);

    const since = fromIsoDate(firstDay(habit));
    const [transactionDays, entryDays] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { date: { gte: since } },
        select: { date: true },
        distinct: ["date"],
      }),
      this.prisma.habitEntry.findMany({ where: { habitId }, select: { date: true } }),
    ]);
    const days = [...new Set([...transactionDays, ...entryDays].map((d) => isoDay(d.date)))];
    if (days.length > 0) await this.sync([{ ...habit, link }], days);
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
    });
    return habits.flatMap((habit) => {
      const link = financeLinkOf(habit.metadata);
      return link ? [{ ...habit, link }] : [];
    });
  }

  /** Writes each habit's entry for each day, skipping ones that are already right. */
  private async sync(habits: LinkedHabit[], days: string[], reconciledOn?: string) {
    const dates = days.map(fromIsoDate);
    const [transactions, stored] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { date: { in: dates } },
        select: {
          date: true,
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
    ]);
    const byDay = new Map<string, DayTransaction[]>();
    for (const t of transactions) {
      const day = isoDay(t.date);
      byDay.set(day, [...(byDay.get(day) ?? []), t]);
    }
    const entryFor = new Map(stored.map((e) => [`${e.habitId}:${isoDay(e.date)}`, e]));

    for (const habit of habits) {
      for (const day of days) {
        await this.write(habit, day, byDay.get(day) ?? [], entryFor.get(`${habit.id}:${day}`), {
          reconciled: day === reconciledOn,
        });
      }
    }
  }

  private async write(
    habit: LinkedHabit,
    date: string,
    transactions: DayTransaction[],
    existing: HabitEntry | undefined,
    { reconciled }: { reconciled: boolean },
  ) {
    if (date < firstDay(habit)) return;
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
