import type { HabitEntry } from "@prisma/client";
import { type PauseRange, isPausedOn } from "#habits/pause.util";
import type { HabitSchedule } from "#habits/schedule.util";
import { isDueOn } from "#habits/schedule.util";

/** The fields of an entry that decide success: stored entries, or an avoid habit's derived ones. */
export type EntryLike = Pick<HabitEntry, "date" | "completed" | "value"> & {
  /** An avoid habit's slip: a definite miss, even today (polarity.util). */
  slip?: boolean;
};

/** A successful check-in: done, or (with a target) the target reached. */
export function isSuccess(entry: EntryLike | undefined, targetValue: number | null): boolean {
  if (!entry) return false;
  if (targetValue != null) return (entry.value ?? 0) >= targetValue;
  return entry.completed || entry.value != null;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Walks backward day-by-day from `today`, only counting days the schedule
 * actually considers "due" (a weekly Mon/Wed/Fri habit isn't broken by a
 * Tuesday with no entry, and a paused day isn't due either). Stops at the
 * first due day that wasn't logged successfully — that's the current
 * streak. Today counts once done, but not done yet doesn't break it. `entries` only needs to cover
 * the window being asked about (see graphql/context.ts's entriesSinceLoader).
 */
export function computeCurrentStreak(
  schedule: HabitSchedule,
  entries: EntryLike[],
  targetValue: number | null,
  today: Date,
  windowDays: number,
  /** Paused days are skipped like days the schedule doesn't make due. */
  pauses: readonly PauseRange[] = [],
): number {
  const byDate = new Map(entries.map((e) => [dateKey(e.date), e]));
  let streak = 0;

  for (let offset = 0; offset < windowDays; offset++) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    if (!isDueOn(schedule, date) || isPausedOn(pauses, dateKey(date))) continue;

    if (isSuccess(byDate.get(dateKey(date)), targetValue)) {
      streak++;
    } else if (offset === 0 && !byDate.get(dateKey(date))?.slip) {
      // Today isn't over: not done yet doesn't break the streak (a slip does).
    } else {
      break;
    }
  }

  return streak;
}

/** Longest run of consecutive successful due-days anywhere in `entries`. */
export function computeLongestStreak(
  schedule: HabitSchedule,
  entries: EntryLike[],
  targetValue: number | null,
  today: Date,
  windowDays: number,
  /** Paused days are skipped like days the schedule doesn't make due. */
  pauses: readonly PauseRange[] = [],
): number {
  const byDate = new Map(entries.map((e) => [dateKey(e.date), e]));
  let longest = 0;
  let running = 0;

  for (let offset = windowDays - 1; offset >= 0; offset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    if (!isDueOn(schedule, date) || isPausedOn(pauses, dateKey(date))) continue;

    if (isSuccess(byDate.get(dateKey(date)), targetValue)) {
      running++;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  return longest;
}

export function computeTotalCompletions(entries: EntryLike[], targetValue: number | null): number {
  return entries.filter((entry) => isSuccess(entry, targetValue)).length;
}
