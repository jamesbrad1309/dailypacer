import { type Day, addDays, startOfWeek, toLocalDate } from "#habits/day.util";
import { type PauseRange, isPausedOn } from "#habits/pause.util";
import { type HabitSchedule, isDueOn } from "#habits/schedule.util";

export type RecordStatus = "DONE" | "PARTIAL" | "NOT_DONE" | "MISSED" | "MISSED_WEEK";
export type RecordFilter = "ALL" | "DONE" | "NOT_DONE" | "MISSED";

/** How far back misses are worked out, so an old habit doesn't produce years of rows. */
export const MISSED_DAYS_LIMIT = 366;

export interface Miss {
  date: Day;
  status: "MISSED" | "MISSED_WEEK";
  /** For MISSED_WEEK: the Monday–Sunday week, its completed check-ins and target. */
  week?: { start: Day; end: Day; done: number; target: number };
}

export function statusOf(entry: { completed: boolean; value: number | null }): RecordStatus {
  if (entry.completed) return "DONE";
  if (entry.value != null && entry.value > 0) return "PARTIAL";
  return "NOT_DONE";
}

/** The first tracked day: the creation day, or an earlier entry's (entries can be backdated). */
export function trackedSince(createdDay: Day, earliestEntry: Day | null): Day {
  return earliestEntry !== null && earliestEntry < createdDay ? earliestEntry : createdDay;
}

/**
 * Misses are counted per week for "times a week" habits (any day can count,
 * so one empty day isn't a miss) and per due day for every other schedule.
 */
export function missesByWeek(schedule: HabitSchedule): boolean {
  return schedule.type === "timesPerWeek";
}

interface MissOptions {
  schedule: HabitSchedule;
  since: Day;
  today: Day;
  /** Every day with an entry (any status) in the window. */
  logged: ReadonlySet<Day>;
  /** Days with a completed entry in the window. */
  completed: ReadonlySet<Day>;
  pauses: readonly PauseRange[];
}

/**
 * A habit's misses, newest first: each past due day with no entry at all,
 * or, for a "times a week" habit, each finished Monday–Sunday week with
 * fewer completed check-ins than its target. Today and this week aren't
 * over, so never count; neither does a week the habit only joined part-way,
 * nor any day (or week touching a day) it was paused.
 */
export function computeMisses({
  schedule,
  since,
  today,
  logged,
  completed,
  pauses,
}: MissOptions): Miss[] {
  const earliest = addDays(today, -MISSED_DAYS_LIMIT);
  const from = since > earliest ? since : earliest;
  const misses: Miss[] = [];

  if (schedule.type === "timesPerWeek") {
    const firstMonday = startOfWeek(from) === from ? from : addDays(startOfWeek(from), 7);
    const lastMonday = addDays(startOfWeek(today), -7);
    for (let start = firstMonday; start <= lastMonday; start = addDays(start, 7)) {
      const end = addDays(start, 6);
      let done = 0;
      let paused = false;
      for (let day = start; day <= end; day = addDays(day, 1)) {
        if (completed.has(day)) done++;
        if (isPausedOn(pauses, day)) paused = true;
      }
      if (!paused && done < schedule.count) {
        misses.push({
          date: end,
          status: "MISSED_WEEK",
          week: { start, end, done, target: schedule.count },
        });
      }
    }
  } else {
    for (let day = from; day < today; day = addDays(day, 1)) {
      if (!logged.has(day) && !isPausedOn(pauses, day) && isDueOn(schedule, toLocalDate(day))) {
        misses.push({ date: day, status: "MISSED" });
      }
    }
  }

  return misses.reverse();
}
