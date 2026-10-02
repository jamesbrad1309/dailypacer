import type { HabitEntryRecord, HabitSchedule } from "#graphql/types";
import { addDays, fromIsoDate, startOfWeek, toIsoDate } from "#lib/dates";
import { isDueOn } from "#lib/schedule";

export type RecordStatus = "done" | "partial" | "notDone" | "missed" | "missedWeek";

export interface HabitRecordRow {
  /** "YYYY-MM-DD" */
  date: string;
  status: RecordStatus;
  /** Absent on a missed day or week: nothing was stored. */
  entry?: HabitEntryRecord;
  /** A "times a week" habit's week that fell short of its target (status "missedWeek"). */
  week?: { start: string; end: string; done: number; target: number };
}

export function isMiss(row: HabitRecordRow): boolean {
  return row.status === "missed" || row.status === "missedWeek";
}

/** How far back missed days are listed, so an old habit doesn't produce years of rows. */
export const MISSED_DAYS_LIMIT = 366;

/** How far back missed weeks are listed. */
export const MISSED_WEEKS_LIMIT = 53;

/**
 * Misses are counted per week for "times a week" habits (any day can count,
 * so one empty day isn't a miss) and per due day for every other schedule.
 */
export function missesByWeek(schedule: HabitSchedule): boolean {
  return schedule.type === "timesPerWeek";
}

/**
 * The first day the habit was tracked: its creation date, or an earlier
 * entry's (check-ins can be logged for days before the habit was created).
 */
export function trackedSince(createdAt: string, entries: readonly HabitEntryRecord[]): string {
  const created = toIsoDate(new Date(createdAt));
  return entries.reduce((first, entry) => (entry.date < first ? entry.date : first), created);
}

export function statusOf(entry: HabitEntryRecord): RecordStatus {
  if (entry.completed) return "done";
  if (entry.value != null && entry.value > 0) return "partial";
  return "notDone";
}

interface Options {
  schedule: HabitSchedule;
  /** The habit's createdAt (ISO timestamp): no day before it (or its first entry) can be missed. */
  createdAt: string;
  today: string;
  includeMissed: boolean;
}

/**
 * A habit's rows for the records table, newest first: one per stored entry,
 * plus (optionally) its misses: each past due day with no entry, or, for a
 * "times a week" habit, each finished Monday–Sunday week with fewer completed
 * check-ins than its target. Today and this week are never missed, since they
 * aren't over, and neither is a first week the habit only joined part-way.
 * Paused stretches aren't recorded anywhere, so misses while paused still show.
 */
export function habitRecordRows(
  entries: readonly HabitEntryRecord[],
  { schedule, createdAt, today, includeMissed }: Options,
): HabitRecordRow[] {
  const rows: HabitRecordRow[] = entries.map((entry) => ({
    date: entry.date,
    status: statusOf(entry),
    entry,
  }));

  if (includeMissed && schedule.type === "timesPerWeek") {
    rows.push(...missedWeeks(entries, schedule.count, trackedSince(createdAt, entries), today));
  } else if (includeMissed) {
    const logged = new Set(entries.map((entry) => entry.date));
    const since = trackedSince(createdAt, entries);
    const earliest = addDays(today, -MISSED_DAYS_LIMIT);
    for (let date = since > earliest ? since : earliest; date < today; date = addDays(date, 1)) {
      if (!logged.has(date) && isDueOn(schedule, fromIsoDate(date))) {
        rows.push({ date, status: "missed" });
      }
    }
  }

  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function missedWeeks(
  entries: readonly HabitEntryRecord[],
  target: number,
  since: string,
  today: string,
): HabitRecordRow[] {
  const done = new Set(entries.filter((entry) => entry.completed).map((entry) => entry.date));
  const rows: HabitRecordRow[] = [];
  // From the first full week after tracking began, to last week.
  const firstMonday = startOfWeek(since) === since ? since : addDays(startOfWeek(since), 7);
  const lastMonday = addDays(startOfWeek(today), -7);
  const earliest = addDays(lastMonday, -7 * (MISSED_WEEKS_LIMIT - 1));
  for (
    let start = firstMonday > earliest ? firstMonday : earliest;
    start <= lastMonday;
    start = addDays(start, 7)
  ) {
    const end = addDays(start, 6);
    let count = 0;
    for (let day = start; day <= end; day = addDays(day, 1)) if (done.has(day)) count++;
    if (count < target) {
      rows.push({ date: end, status: "missedWeek", week: { start, end, done: count, target } });
    }
  }
  return rows;
}
