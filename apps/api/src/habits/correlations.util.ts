import type { DayCell } from "#habits/day-status.util";

export interface CorrelationHabit {
  id: string;
  name: string;
  /** Has a unit: compare its values rather than whether it was done. */
  quantified: boolean;
  cells: readonly DayCell[];
}

export interface Correlation {
  /** On days this one was done… */
  habitId: string;
  /** …this other one went differently. */
  otherId: string;
  /** RATE: how often the other was done. VALUE: the other's average value. */
  kind: "RATE" | "VALUE";
  /** With the first habit done / not done: a rate (0–1) or an average value. */
  withValue: number;
  withoutValue: number;
  daysWith: number;
  daysWithout: number;
}

/** Each side needs this many days before a difference means anything. */
export const MIN_DAYS = 5;
/** Done-rates must differ by 20 points, values by 15%, to be worth saying. */
const MIN_RATE_GAP = 0.2;
const MIN_VALUE_GAP = 0.15;

const DUE_DONE_OR_NOT = new Set(["DONE", "MISSED", "PARTIAL", "SLIPPED"]);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * Pairs of habits that move together over past days: on days habit A was
 * due, split by whether A was done, how often B was done (or, for a habit
 * with a unit, its average value). Only differences with enough days on
 * each side and a big enough gap are kept, strongest first. Days the other
 * habit wasn't due or has no value are left out. This is a pattern, not a
 * cause.
 */
export function correlations(habits: CorrelationHabit[], today: string, limit = 12): Correlation[] {
  const byDay = habits.map(
    (h) => new Map(h.cells.filter((c) => c.date < today).map((c) => [c.date, c])),
  );
  const found: (Correlation & { strength: number })[] = [];
  habits.forEach((a, i) => {
    habits.forEach((b, j) => {
      if (i === j) return;
      const withA: number[] = [];
      const withoutA: number[] = [];
      for (const [date, cell] of byDay[i]) {
        if (!DUE_DONE_OR_NOT.has(cell.status)) continue;
        const other = byDay[j].get(date);
        if (!other) continue;
        let sample: number | null = null;
        if (b.quantified) sample = other.value;
        else if (DUE_DONE_OR_NOT.has(other.status)) sample = other.status === "DONE" ? 1 : 0;
        if (sample === null) continue;
        (cell.status === "DONE" ? withA : withoutA).push(sample);
      }
      if (withA.length < MIN_DAYS || withoutA.length < MIN_DAYS) return;
      const withValue = mean(withA);
      const withoutValue = mean(withoutA);
      const strength = b.quantified
        ? Math.abs(withValue - withoutValue) / Math.max(Math.abs(withoutValue), 1e-9)
        : Math.abs(withValue - withoutValue);
      if (strength < (b.quantified ? MIN_VALUE_GAP : MIN_RATE_GAP)) return;
      found.push({
        habitId: a.id,
        otherId: b.id,
        kind: b.quantified ? "VALUE" : "RATE",
        withValue,
        withoutValue,
        daysWith: withA.length,
        daysWithout: withoutA.length,
        strength,
      });
    });
  });
  return found
    .sort((x, y) => y.strength - x.strength)
    .slice(0, limit)
    .map(({ strength: _, ...rest }) => rest);
}
