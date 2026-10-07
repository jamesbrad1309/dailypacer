import { Injectable } from "@nestjs/common";
import type { Habit, HabitChallenge, HabitEntry } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import type { ChallengeLike } from "#habits/challenge.util";
import { type Day, toDay } from "#habits/day.util";
import { entriesByDay, type HabitDays } from "#habits/day-status.util";
import { trackedSince } from "#habits/habit-records.util";
import { HabitsService } from "#habits/habits.service";
import type { PauseRange } from "#habits/pause.util";
import { effectiveEntries } from "#habits/polarity.util";
import type { HabitSchedule } from "#habits/schedule.util";
import { type EntryLike, isSuccess } from "#habits/streak.util";

export interface HabitHistory {
  habit: Habit;
  schedule: HabitSchedule;
  /** The first tracked day: creation, or an earlier backdated entry. */
  since: Day;
  /** For day-status.util: per-day statuses. */
  days: HabitDays;
  /** Stored entries from `from` on. */
  stored: HabitEntry[];
  /** What success is judged on: stored entries, or an avoid habit's derived ones. */
  effective: EntryLike[];
  /** Pauses, freezes and the days after a time-boxed habit's end: not due. */
  notDue: PauseRange[];
  /** Days with a successful check-in, from `from` on. */
  successDays: Set<Day>;
  challenges: (ChallengeLike & { id: string })[];
  /** Avoid habits ignore the target: a slip is a slip. */
  targetValue: number | null;
}

/**
 * Loads habits with everything that decides how a day went, once, for
 * stats, the calendar, the weekly review, achievements, correlations and
 * points. `from` limits the entries read (null: all of them).
 */
@Injectable()
export class HabitHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly habitsService: HabitsService,
  ) {}

  async load(habits: readonly Habit[], from: Day | null, today: Day): Promise<HabitHistory[]> {
    const ids = habits.map((h) => h.id);
    if (ids.length === 0) return [];
    const [entries, earliest, notDue, pauses, freezes, challenges] = await Promise.all([
      this.prisma.habitEntry.findMany({
        where: { habitId: { in: ids }, ...(from ? { date: { gte: new Date(from) } } : {}) },
        orderBy: { date: "asc" },
      }),
      this.prisma.habitEntry.groupBy({
        by: ["habitId"],
        where: { habitId: { in: ids } },
        _min: { date: true },
      }),
      this.habitsService.pausesFor(ids),
      this.habitsService.realPausesFor(ids),
      this.habitsService.freezesFor(ids),
      this.prisma.habitChallenge.findMany({ where: { habitId: { in: ids } } }),
    ]);

    return habits.map((habit) => {
      const stored = entries.filter((e) => e.habitId === habit.id);
      const first = earliest.find((e) => e.habitId === habit.id)?._min.date;
      const since = trackedSince(toDay(habit.createdAt), first ? toDay(first) : null);
      const schedule = habit.schedule as HabitSchedule;
      const ranges = notDue.get(habit.id) ?? [];
      const avoid = habit.polarity === "avoid";
      const targetValue = avoid ? null : habit.targetValue;
      const effective = effectiveEntries(habit.polarity, stored, {
        schedule,
        since: from && from > since ? from : since,
        today,
        pauses: ranges,
      });
      return {
        habit,
        schedule,
        since,
        stored,
        effective,
        notDue: ranges,
        targetValue,
        successDays: new Set(
          effective.filter((e) => isSuccess(e, targetValue)).map((e) => toDay(e.date)),
        ),
        challenges: challenges.filter((c) => c.habitId === habit.id).map(toChallenge),
        days: {
          schedule,
          polarity: habit.polarity,
          targetValue,
          since,
          endDate: habit.endDate ? toDay(habit.endDate) : null,
          pauses: pauses.get(habit.id) ?? [],
          frozen: freezes.get(habit.id) ?? new Set(),
          entries: entriesByDay(stored),
        },
      };
    });
  }
}

export function toChallenge(c: HabitChallenge): ChallengeLike & { id: string } {
  return {
    id: c.id,
    startDate: toDay(c.startDate),
    endDate: toDay(c.endDate),
    target: c.target,
    multiplier: c.multiplier,
  };
}
