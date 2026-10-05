import { type Day, addDays, toDay, toLocalDate } from "#habits/day.util";
import { type PauseRange, isPausedOn } from "#habits/pause.util";
import { isSlip } from "#habits/polarity.util";
import { type HabitSchedule, isDueOn } from "#habits/schedule.util";
import { type EntryLike, isSuccess } from "#habits/streak.util";

/**
 * A habit on one day. DONE: checked off (an avoid habit: no slip). PARTIAL:
 * a value short of done. SLIPPED: an avoid habit's slip. MISSED: a past due
 * day not done. DUE: due today or later, not done yet. FROZEN: a missed day
 * bought back with points. PAUSED, OFF (not due by the schedule; any day of
 * a "times a week" habit that isn't done), NONE (before tracking began or
 * after a time-boxed habit ended).
 */
export type DayStatus =
  | "DONE"
  | "PARTIAL"
  | "SLIPPED"
  | "MISSED"
  | "DUE"
  | "FROZEN"
  | "PAUSED"
  | "OFF"
  | "NONE";

export interface HabitDays {
  schedule: HabitSchedule;
  polarity: string;
  targetValue: number | null;
  /** The first tracked day. */
  since: Day;
  /** A time-boxed habit's last day. */
  endDate: Day | null;
  /** Real pauses only (freezes are `frozen`). */
  pauses: readonly PauseRange[];
  frozen: ReadonlySet<Day>;
  /** Stored entries by day. */
  entries: ReadonlyMap<Day, EntryLike>;
}

export interface DayCell {
  date: Day;
  status: DayStatus;
  value: number | null;
}

export function dayStatus(habit: HabitDays, day: Day, today: Day): DayStatus {
  if (day < habit.since || (habit.endDate && day > habit.endDate)) return "NONE";
  const entry = habit.entries.get(day);
  if (habit.frozen.has(day)) return "FROZEN";
  if (isPausedOn(habit.pauses, day)) return "PAUSED";
  const due = isDueOn(habit.schedule, toLocalDate(day));
  if (habit.polarity === "avoid") {
    if (!due) return "OFF";
    if (entry && isSlip(entry)) return "SLIPPED";
    return day <= today ? "DONE" : "DUE";
  }
  if (entry && isSuccess(entry, habit.targetValue)) return "DONE";
  if (entry && entry.value != null && entry.value > 0) return "PARTIAL";
  if (habit.schedule.type === "timesPerWeek") return "OFF";
  if (!due) return "OFF";
  return day < today ? "MISSED" : "DUE";
}

/** One cell per day from `from` to `to`, both included. */
export function dayCells(habit: HabitDays, from: Day, to: Day, today: Day): DayCell[] {
  const cells: DayCell[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    cells.push({
      date: day,
      status: dayStatus(habit, day, today),
      value: habit.entries.get(day)?.value ?? null,
    });
  }
  return cells;
}

/** Stored entries keyed by day, for HabitDays. */
export function entriesByDay(entries: readonly EntryLike[]): Map<Day, EntryLike> {
  return new Map(entries.map((entry) => [toDay(entry.date), entry]));
}

/** Counted toward a day's or week's "due": it was asked of you (done or not). */
export const COUNTS_AS_DUE: ReadonlySet<DayStatus> = new Set([
  "DONE",
  "PARTIAL",
  "SLIPPED",
  "MISSED",
  "DUE",
]);
