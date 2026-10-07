import { addDays, type Day } from "#habits/day.util";
import { COUNTS_AS_DUE, type DayCell } from "#habits/day-status.util";
import type { HabitSchedule } from "#habits/schedule.util";

export interface ReviewHabitInput {
  id: string;
  name: string;
  schedule: HabitSchedule;
  currentStreak: number;
  /** Days from the Monday before the week through its Sunday (14 days). */
  cells: readonly DayCell[];
}

export interface ReviewHabit {
  id: string;
  name: string;
  done: number;
  due: number;
  /** done / due, 0–1; null when it wasn't due. */
  rate: number | null;
  /** Due days missed (or slipped), oldest first. */
  missed: Day[];
  frozen: number;
}

export interface Totals {
  done: number;
  due: number;
  rate: number | null;
}

export interface WeeklyReview {
  weekStart: Day;
  weekEnd: Day;
  /** False while the week is still going (its rest is still due). */
  complete: boolean;
  totals: Totals;
  previous: Totals;
  habits: ReviewHabit[];
  /** Habits done every time they were due. */
  wins: string[];
  /** Habits with a current streak of 3+ due today and not done yet (this week only). */
  atRisk: { id: string; name: string; currentStreak: number }[];
  /** The day with the most check-ins. */
  bestDay: { date: Day; done: number } | null;
}

const rate = (done: number, due: number) => (due > 0 ? Math.min(1, done / due) : null);

/**
 * A habit's done / due over some days. Frozen and paused days aren't due;
 * a "times a week" habit is due its weekly count (when tracked at all).
 */
function tally(habit: ReviewHabitInput, cells: readonly DayCell[]) {
  const done = cells.filter((c) => c.status === "DONE").length;
  if (habit.schedule.type === "timesPerWeek") {
    const tracked = cells.some((c) => c.status !== "NONE" && c.status !== "PAUSED");
    return { done, due: tracked ? habit.schedule.count : 0 };
  }
  return { done, due: cells.filter((c) => COUNTS_AS_DUE.has(c.status)).length };
}

/**
 * A Monday–Sunday week of habits: done against due for each and in all,
 * against the week before; the habits done every time (wins), the days
 * missed, streaks at risk today, and the best day.
 */
export function weeklyReview(habits: ReviewHabitInput[], weekStart: Day, today: Day): WeeklyReview {
  const weekEnd = addDays(weekStart, 6);
  const inWeek = (c: DayCell) => c.date >= weekStart && c.date <= weekEnd;
  const inPrevious = (c: DayCell) => c.date < weekStart;

  const rows: ReviewHabit[] = habits.map((habit) => {
    const cells = habit.cells.filter(inWeek);
    const { done, due } = tally(habit, cells);
    return {
      id: habit.id,
      name: habit.name,
      done,
      due,
      rate: rate(done, due),
      missed: cells
        .filter((c) => c.status === "MISSED" || c.status === "SLIPPED")
        .map((c) => c.date),
      frozen: cells.filter((c) => c.status === "FROZEN").length,
    };
  });
  const sum = (list: { done: number; due: number }[]) => {
    const done = list.reduce((s, r) => s + r.done, 0);
    const due = list.reduce((s, r) => s + r.due, 0);
    return { done, due, rate: rate(done, due) };
  };
  const previous = sum(habits.map((h) => tally(h, h.cells.filter(inPrevious))));

  const byDay = new Map<Day, number>();
  for (const habit of habits) {
    for (const cell of habit.cells.filter(inWeek)) {
      if (cell.status === "DONE") byDay.set(cell.date, (byDay.get(cell.date) ?? 0) + 1);
    }
  }
  const best = [...byDay.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];

  const thisWeek = today >= weekStart && today <= weekEnd;
  return {
    weekStart,
    weekEnd,
    complete: today > weekEnd,
    totals: sum(rows),
    previous,
    habits: rows,
    wins: rows
      .filter((r) => r.due > 0 && r.done >= r.due && r.missed.length === 0)
      .map((r) => r.id),
    atRisk: thisWeek
      ? habits
          .filter(
            (h) => h.currentStreak >= 3 && h.cells.find((c) => c.date === today)?.status === "DUE",
          )
          .map((h) => ({ id: h.id, name: h.name, currentStreak: h.currentStreak }))
      : [],
    bestDay: best ? { date: best[0], done: best[1] } : null,
  };
}
