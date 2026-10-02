import type { HeatmapDay } from "#graphql/types";
import { addDays, startOfWeek } from "#lib/dates";

export interface WeekPoint {
  /** 0 = Monday … 6 = Sunday. */
  index: number;
  /** "YYYY-MM-DD" of this day in each week. */
  thisDate: string;
  lastDate: string;
  /** Check-ins so far this week, through this day; null for days still ahead. */
  thisWeek: number | null;
  /** Check-ins so far last week, through the same weekday. */
  lastWeek: number;
}

export interface WeekComparison {
  points: WeekPoint[];
  thisTotal: number;
  /** Last week's count through today's weekday: the fair comparison mid-week. */
  lastSoFar: number;
  lastTotal: number;
  /** Today's index (0 = Monday). */
  todayIndex: number;
}

/**
 * This week against last week (Monday-first), as running check-in counts per
 * day, from a habit's daily heatmap. Days missing from the heatmap count as 0.
 */
export function compareWeeks(days: readonly HeatmapDay[], today: string): WeekComparison {
  const done = new Set(days.filter((day) => day.completed).map((day) => day.date));
  const thisMonday = startOfWeek(today);
  const lastMonday = addDays(thisMonday, -7);

  let thisRun = 0;
  let lastRun = 0;
  const points: WeekPoint[] = Array.from({ length: 7 }, (_, index) => {
    const thisDate = addDays(thisMonday, index);
    const lastDate = addDays(lastMonday, index);
    if (done.has(lastDate)) lastRun++;
    const ahead = thisDate > today;
    if (!ahead && done.has(thisDate)) thisRun++;
    return { index, thisDate, lastDate, thisWeek: ahead ? null : thisRun, lastWeek: lastRun };
  });

  const todayIndex = points.findIndex((point) => point.thisDate === today);
  return {
    points,
    thisTotal: thisRun,
    lastSoFar: points[todayIndex].lastWeek,
    lastTotal: lastRun,
    todayIndex,
  };
}
