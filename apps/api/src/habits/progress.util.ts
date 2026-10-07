import { addDays, type Day } from "#habits/day.util";
import { COUNTS_AS_DUE, type DayCell } from "#habits/day-status.util";
import type { HabitSchedule } from "#habits/schedule.util";

export interface ProgressHabitInput {
  id: string;
  name: string;
  schedule: HabitSchedule;
  /** Days from the first Monday shown through today. */
  cells: readonly DayCell[];
}

export interface WeekTotals {
  /** Monday. */
  weekStart: Day;
  done: number;
  due: number;
  rate: number | null;
}

export interface HabitProgress {
  /** Oldest first; the last week is the current one, so far. */
  weeks: WeekTotals[];
  habits: {
    id: string;
    name: string;
    done: number;
    due: number;
    rate: number | null;
    /** Check-ins in each week, oldest first (same order as `weeks`). */
    perWeek: number[];
    /** What was due in each week, in the same order. */
    perWeekDue: number[];
  }[];
  /** Every day with something due: how much of it was done (for comparing with mood). */
  days: { date: Day; done: number; due: number }[];
}

const rate = (done: number, due: number) => (due > 0 ? Math.min(1, done / due) : null);

/**
 * A habit's done / due in some days: due days by its schedule (not
 * frozen, paused or untracked), or for a "times a week" habit its weekly
 * count, prorated for a week only partly tracked or not over yet.
 */
function tally(habit: ProgressHabitInput, cells: readonly DayCell[], today: Day) {
  const done = cells.filter((c) => c.status === "DONE").length;
  if (habit.schedule.type === "timesPerWeek") {
    const tracked = cells.filter(
      (c) =>
        c.status !== "NONE" && c.status !== "PAUSED" && c.status !== "FROZEN" && c.date <= today,
    ).length;
    return { done, due: Math.max(done, Math.round((habit.schedule.count * tracked) / 7)) };
  }
  // Today counts only once it's done: an unticked morning isn't a miss.
  const due = cells.filter(
    (c) => COUNTS_AS_DUE.has(c.status) && (c.date < today || c.status === "DONE"),
  ).length;
  return { done, due };
}

/**
 * How habits went, week by week, over `weeks` Monday–Sunday weeks ending
 * with the current one: totals per week, each habit over the whole period
 * and per week, and each day's done / due.
 */
export function habitProgress(
  habits: readonly ProgressHabitInput[],
  firstMonday: Day,
  weeks: number,
  today: Day,
): HabitProgress {
  const starts = Array.from({ length: weeks }, (_, i) => addDays(firstMonday, i * 7));
  const inWeek = (start: Day) => (c: DayCell) => c.date >= start && c.date <= addDays(start, 6);

  const perHabit = habits.map((habit) => {
    const weekly = starts.map((start) => tally(habit, habit.cells.filter(inWeek(start)), today));
    const done = weekly.reduce((s, w) => s + w.done, 0);
    const due = weekly.reduce((s, w) => s + w.due, 0);
    return { habit, weekly, done, due };
  });

  const byDay = new Map<Day, { done: number; due: number }>();
  for (const habit of habits) {
    if (habit.schedule.type === "timesPerWeek") continue;
    for (const cell of habit.cells) {
      if (!COUNTS_AS_DUE.has(cell.status) || (cell.date >= today && cell.status !== "DONE"))
        continue;
      const day = byDay.get(cell.date) ?? { done: 0, due: 0 };
      day.due++;
      if (cell.status === "DONE") day.done++;
      byDay.set(cell.date, day);
    }
  }

  return {
    weeks: starts.map((weekStart, i) => {
      const done = perHabit.reduce((s, h) => s + h.weekly[i].done, 0);
      const due = perHabit.reduce((s, h) => s + h.weekly[i].due, 0);
      return { weekStart, done, due, rate: rate(done, due) };
    }),
    habits: perHabit.map(({ habit, weekly, done, due }) => ({
      id: habit.id,
      name: habit.name,
      done,
      due,
      rate: rate(done, due),
      perWeek: weekly.map((w) => w.done),
      perWeekDue: weekly.map((w) => w.due),
    })),
    days: [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, d]) => ({ date, ...d })),
  };
}
