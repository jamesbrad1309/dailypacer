import { type Day, addDays, toDay, toLocalDate } from "#habits/day.util";
import { type PauseRange, isPausedOn } from "#habits/pause.util";
import { type HabitSchedule, isDueOn } from "#habits/schedule.util";
import type { EntryLike } from "#habits/streak.util";

/** "build": do it ("Read"). "avoid": don't ("No sugar"), and log a slip when it happens. */
export type Polarity = "build" | "avoid";

/**
 * An avoid habit's entry records a slip when it isn't marked done and has a
 * value above zero (the number of slips that day). Logging 0 undoes a slip.
 */
export function isSlip(entry: Pick<EntryLike, "completed" | "value">): boolean {
  return !entry.completed && (entry.value ?? 0) > 0;
}

interface AvoidOptions {
  schedule: HabitSchedule;
  /** The first tracked day: nothing before it counts. */
  since: Day;
  /** Up to and including this day: today counts as clean until a slip is logged. */
  today: Day;
  pauses: readonly PauseRange[];
}

/**
 * An avoid habit's entries as streaks, points, heatmaps and insights read
 * them: every due, unpaused day from `since` to `today` without a slip is a
 * completed check-in, and a slip day is a not-completed one. So the rest of
 * the habit code works on avoid habits unchanged.
 */
export function avoidEntries(
  stored: readonly EntryLike[],
  { schedule, since, today, pauses }: AvoidOptions,
): EntryLike[] {
  const slips = new Map(stored.filter(isSlip).map((entry) => [toDay(entry.date), entry] as const));
  const result: EntryLike[] = [];
  for (let day = since; day <= today; day = addDays(day, 1)) {
    if (!isDueOn(schedule, toLocalDate(day)) || isPausedOn(pauses, day)) continue;
    const slip = slips.get(day);
    result.push(
      slip
        ? { date: new Date(day), completed: false, value: null, slip: true }
        : { date: new Date(day), completed: true, value: null },
    );
  }
  return result;
}

/** The entries success is judged on: stored ones for a build habit, derived ones for an avoid habit. */
export function effectiveEntries(
  polarity: string,
  stored: readonly EntryLike[],
  options: AvoidOptions,
): EntryLike[] {
  return polarity === "avoid" ? avoidEntries(stored, options) : [...stored];
}
