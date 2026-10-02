import { describe, expect, it } from "vitest";
import type { HeatmapDay } from "#graphql/types";
import { compareWeeks } from "#lib/week-comparison";

const done = (...dates: string[]): HeatmapDay[] =>
  dates.map((date) => ({ date, completed: true, value: null }));

describe("compareWeeks", () => {
  // 2026-10-01 is a Thursday: this week starts Mon 28 Sep, last week Mon 21 Sep.
  const today = "2026-10-01";

  it("runs both weeks' counts Monday to Sunday, stopping this week at today", () => {
    const result = compareWeeks(
      done("2026-09-21", "2026-09-23", "2026-09-27", "2026-09-28", "2026-10-01"),
      today,
    );
    expect(result.points.map((p) => p.lastWeek)).toEqual([1, 1, 2, 2, 2, 2, 3]);
    expect(result.points.map((p) => p.thisWeek)).toEqual([1, 1, 1, 2, null, null, null]);
    expect(result).toMatchObject({ thisTotal: 2, lastSoFar: 2, lastTotal: 3, todayIndex: 3 });
  });

  it("ignores days that weren't completed or fall outside the two weeks", () => {
    const days: HeatmapDay[] = [
      ...done("2026-09-20", "2026-10-02"),
      { date: "2026-09-29", completed: false, value: 2 },
    ];
    const result = compareWeeks(days, today);
    expect(result.thisTotal).toBe(0);
    expect(result.lastTotal).toBe(0);
  });

  it("works on a Monday and a Sunday", () => {
    expect(compareWeeks(done("2026-09-28"), "2026-09-28").todayIndex).toBe(0);
    expect(compareWeeks([], "2026-10-04").todayIndex).toBe(6);
  });
});
