import { addDays, type Day, startOfWeek } from "#habits/day.util";
import { COUNTS_AS_DUE, type DayCell } from "#habits/day-status.util";

export type AchievementKey =
  | "FIRST_CHECK_IN"
  | "CHECK_INS_100"
  | "CHECK_INS_500"
  | "STREAK_7"
  | "STREAK_30"
  | "STREAK_100"
  | "PERFECT_WEEK"
  | "CHALLENGE_WON"
  | "LEVEL_5";

export interface Achievement {
  key: AchievementKey;
  /** How far along: check-ins, best streak, perfect weeks, challenges won or level. */
  progress: number;
  target: number;
  unlocked: boolean;
  /** The day it was reached, where that can be worked out; null otherwise. */
  achievedOn: Day | null;
}

interface Input {
  /** Every habit's days, from its first tracked day to today (see day-status.util). */
  habits: { cells: readonly DayCell[] }[];
  /** The dashboard level now. */
  level: number;
  /** The days challenges were won, oldest first. */
  challengeWins: readonly Day[];
  today: Day;
}

/** Days a streak can't cross: a due day not done. */
const BREAKS = new Set(["MISSED", "SLIPPED", "PARTIAL"]);

/** The best streak in a habit's days, and the first day its run reached each of `marks`. */
function streakMarks(cells: readonly DayCell[], marks: readonly number[]) {
  let running = 0;
  let best = 0;
  const reached = new Map<number, Day>();
  for (const cell of cells) {
    if (cell.status === "DONE") {
      running++;
      best = Math.max(best, running);
      for (const mark of marks) {
        if (running === mark && !reached.has(mark)) reached.set(mark, cell.date);
      }
    } else if (BREAKS.has(cell.status)) {
      running = 0;
    }
  }
  return { best, reached };
}

/**
 * Badges worked out from history every time (nothing stored): the first
 * check-in and 100 / 500 of them, a 7 / 30 / 100-day streak on any habit,
 * a perfect week (every due habit-day of a finished Monday–Sunday week
 * done), a won challenge, and level 5.
 */
export function achievements({ habits, level, challengeWins, today }: Input): Achievement[] {
  const doneDays = habits
    .flatMap((h) => h.cells.filter((c) => c.status === "DONE").map((c) => c.date))
    .sort();
  const nth = (n: number) => doneDays[n - 1] ?? null;

  const marks = [7, 30, 100];
  const streaks = habits.map((h) => streakMarks(h.cells, marks));
  const best = streaks.reduce((max, s) => Math.max(max, s.best), 0);
  const firstReached = (mark: number) =>
    streaks
      .map((s) => s.reached.get(mark))
      .filter((d): d is Day => d !== undefined)
      .sort()[0] ?? null;

  // Perfect weeks: finished weeks where every due habit-day was done.
  const weeks = new Map<Day, { due: number; done: number }>();
  const lastFinishedSunday = addDays(startOfWeek(today), -1);
  for (const habit of habits) {
    for (const cell of habit.cells) {
      if (cell.date > lastFinishedSunday || !COUNTS_AS_DUE.has(cell.status)) continue;
      const week = startOfWeek(cell.date);
      const stats = weeks.get(week) ?? { due: 0, done: 0 };
      stats.due++;
      if (cell.status === "DONE") stats.done++;
      weeks.set(week, stats);
    }
  }
  const perfect = [...weeks.entries()]
    .filter(([, w]) => w.due > 0 && w.done === w.due)
    .map(([monday]) => addDays(monday, 6))
    .sort();

  const count = (key: AchievementKey, progress: number, target: number, on: Day | null) => ({
    key,
    progress: Math.min(progress, target),
    target,
    unlocked: progress >= target,
    achievedOn: progress >= target ? on : null,
  });
  return [
    count("FIRST_CHECK_IN", doneDays.length, 1, nth(1)),
    count("STREAK_7", best, 7, firstReached(7)),
    count("PERFECT_WEEK", perfect.length, 1, perfect[0] ?? null),
    count("CHALLENGE_WON", challengeWins.length, 1, challengeWins[0] ?? null),
    count("STREAK_30", best, 30, firstReached(30)),
    count("CHECK_INS_100", doneDays.length, 100, nth(100)),
    count("LEVEL_5", level, 5, null),
    count("STREAK_100", best, 100, firstReached(100)),
    count("CHECK_INS_500", doneDays.length, 500, nth(500)),
  ];
}
