import { type Day, addDays, toLocalDate } from "#habits/day.util";
import { type PauseRange, isPausedOn } from "#habits/pause.util";
import { type HabitSchedule, isDueOn } from "#habits/schedule.util";

/** How far back the weekday pattern looks: twelve of each weekday. */
export const WEEKDAY_WINDOW_DAYS = 84;
/** A weekday needs this many due days before it can be called best or worst. */
const MIN_DUE_FOR_RANKING = 3;

export interface WeekdayStat {
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
  due: number;
  done: number;
  /** done / due, 0–1; null when the weekday was never due. */
  rate: number | null;
}

export interface Period {
  from: Day;
  to: Day;
  due: number;
  done: number;
  rate: number | null;
}

export interface HabitInsights {
  weekdays: WeekdayStat[];
  /** Weekday indexes (0 = Monday); null when the pattern is too thin or flat to call. */
  best: number | null;
  worst: number | null;
  thisMonth: Period;
  lastMonth: Period;
}

interface Options {
  schedule: HabitSchedule;
  since: Day;
  today: Day;
  completed: ReadonlySet<Day>;
  pauses: readonly PauseRange[];
}

const mondayIndex = (day: Day) => (toLocalDate(day).getDay() + 6) % 7;

/**
 * A day "counts" when it's on or after `since`, not paused, and either due
 * by the schedule or (for "times a week" habits, where any day can count) a
 * day with a check-in. Today counts only if it's already done, so an unticked
 * morning doesn't drag the rates down.
 */
function counts(day: Day, { schedule, since, today, completed, pauses }: Options): boolean {
  if (day < since || isPausedOn(pauses, day)) return false;
  if (day === today && !completed.has(day)) return false;
  return schedule.type === "timesPerWeek"
    ? completed.has(day)
    : isDueOn(schedule, toLocalDate(day));
}

function period(from: Day, to: Day, options: Options): Period {
  let due = 0;
  let done = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    if (!counts(day, options)) continue;
    due++;
    if (options.completed.has(day)) done++;
  }
  if (options.schedule.type === "timesPerWeek") {
    // Against the weekly target instead: count per week, prorated to the period.
    const weeks = (Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1) / 7;
    due = Math.max(1, Math.round(options.schedule.count * weeks));
  }
  return { from, to, due, done, rate: due > 0 ? Math.min(1, done / due) : null };
}

/**
 * Which weekdays a habit tends to get done or skipped (over the last twelve
 * weeks) and this month's completion rate against last month's. For a
 * "times a week" habit, weekdays compare where its check-ins fall, and the
 * months compare check-ins against the weekly target.
 */
export function habitInsights(options: Options): HabitInsights {
  const { today, completed, schedule } = options;
  const byWeekday = Array.from({ length: 7 }, (_, weekday) => ({ weekday, due: 0, done: 0 }));
  for (let i = 0; i < WEEKDAY_WINDOW_DAYS; i++) {
    const day = addDays(today, -i);
    const stat = byWeekday[mondayIndex(day)];
    if (schedule.type === "timesPerWeek") {
      if (day >= options.since && !isPausedOn(options.pauses, day)) {
        stat.due++;
        if (completed.has(day)) stat.done++;
      }
    } else if (counts(day, options)) {
      stat.due++;
      if (completed.has(day)) stat.done++;
    }
  }
  const weekdays = byWeekday.map((s) => ({ ...s, rate: s.due > 0 ? s.done / s.due : null }));

  const ranked = weekdays.filter((s) => s.due >= MIN_DUE_FOR_RANKING && s.rate !== null);
  const sorted = [...ranked].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  const flat = sorted.length < 2 || sorted[0].rate === sorted[sorted.length - 1].rate;

  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = addDays(monthStart, -1);
  const lastMonthStart = `${lastMonthEnd.slice(0, 7)}-01`;

  return {
    weekdays,
    best: flat ? null : sorted[0].weekday,
    worst: flat ? null : sorted[sorted.length - 1].weekday,
    thisMonth: period(monthStart, today, options),
    lastMonth: period(lastMonthStart, lastMonthEnd, options),
  };
}
