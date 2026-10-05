/** Helpers for the Progress page: splitting a doubled period, mood by week, mood on strong vs light habit days. */

/** The periods the page offers, in weeks. */
export const PERIODS = [4, 12, 26] as const;
export type Period = (typeof PERIODS)[number];

/** The page shows `weeks` weeks and compares them with the `weeks` before: the second half is "now". */
export function halves<T>(items: readonly T[], weeks: number): { previous: T[]; current: T[] } {
  return { previous: items.slice(-2 * weeks, -weeks), current: items.slice(-weeks) };
}

/** done / due over some weeks (null when nothing was due). */
export function rateOf(weeks: readonly { done: number; due: number }[]): number | null {
  const due = weeks.reduce((s, w) => s + w.due, 0);
  const done = weeks.reduce((s, w) => s + w.done, 0);
  return due > 0 ? Math.min(1, done / due) : null;
}

function mondayOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/**
 * Each week's mood: the average of its days' scores (each day with a
 * feeling counts once), null for a week with none. `weekStarts` are Mondays.
 */
export function moodByWeek(
  dayScores: ReadonlyMap<string, number>,
  weekStarts: readonly string[],
): { weekStart: string; mood: number | null; days: number }[] {
  const sums = new Map<string, { total: number; days: number }>();
  for (const [day, score] of dayScores) {
    const week = mondayOf(day);
    const entry = sums.get(week) ?? { total: 0, days: 0 };
    entry.total += score;
    entry.days++;
    sums.set(week, entry);
  }
  return weekStarts.map((weekStart) => {
    const entry = sums.get(weekStart);
    return { weekStart, mood: entry ? entry.total / entry.days : null, days: entry?.days ?? 0 };
  });
}

/** A day counts as a strong habit day from this share done, and a light one below LIGHT. */
export const STRONG = 0.8;
export const LIGHT = 0.5;
/** Each group needs this many days with a mood before it's compared. */
export const MIN_MOOD_DAYS = 3;

export interface MoodByHabitDays {
  strong: { mood: number; days: number } | null;
  light: { mood: number; days: number } | null;
}

/**
 * Average mood on strong habit days (80%+ of what was due done) and on light
 * ones (under half), over days with both habits due and a mood. A group
 * with fewer than MIN_MOOD_DAYS days is null: too few to say anything.
 */
export function moodByHabitDays(
  days: readonly { date: string; done: number; due: number }[],
  dayScores: ReadonlyMap<string, number>,
): MoodByHabitDays {
  const strong: number[] = [];
  const light: number[] = [];
  for (const day of days) {
    const score = dayScores.get(day.date);
    if (score === undefined || day.due === 0) continue;
    const share = day.done / day.due;
    if (share >= STRONG) strong.push(score);
    else if (share < LIGHT) light.push(score);
  }
  const summary = (scores: number[]) =>
    scores.length >= MIN_MOOD_DAYS
      ? { mood: scores.reduce((s, x) => s + x, 0) / scores.length, days: scores.length }
      : null;
  return { strong: summary(strong), light: summary(light) };
}

/**
 * The habits to stack by name: the `slots` with the most check-ins, and
 * everyone else folded into one "Other" series (never a ninth colour).
 */
export function topWithOther<T extends { done: number }>(
  habits: readonly T[],
  slots: number,
): { shown: T[]; other: T[] } {
  const sorted = [...habits].sort((a, b) => b.done - a.done);
  if (sorted.length <= slots) return { shown: sorted, other: [] };
  return { shown: sorted.slice(0, slots - 1), other: sorted.slice(slots - 1) };
}
