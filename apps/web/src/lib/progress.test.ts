import { describe, expect, it } from "vitest";
import { halves, moodByHabitDays, moodByWeek, rateOf, topWithOther } from "#lib/progress";

describe("halves and rateOf", () => {
  it("splits a doubled period and rates each half", () => {
    const weeks = [
      { done: 1, due: 2 },
      { done: 2, due: 2 },
      { done: 3, due: 4 },
      { done: 4, due: 4 },
    ];
    const { previous, current } = halves(weeks, 2);
    expect(rateOf(previous)).toBe(0.75);
    expect(rateOf(current)).toBe(7 / 8);
    expect(rateOf([])).toBeNull();
  });
});

describe("moodByWeek", () => {
  it("averages the days with a feeling in each Monday–Sunday week", () => {
    const scores = new Map([
      ["2026-09-28", 1],
      ["2026-10-04", 0],
      ["2026-10-05", -1],
    ]);
    expect(moodByWeek(scores, ["2026-09-28", "2026-10-05", "2026-10-12"])).toEqual([
      { weekStart: "2026-09-28", mood: 0.5, days: 2 },
      { weekStart: "2026-10-05", mood: -1, days: 1 },
      { weekStart: "2026-10-12", mood: null, days: 0 },
    ]);
  });
});

describe("moodByHabitDays", () => {
  it("compares mood on strong habit days with light ones", () => {
    const days = [
      ...["01", "02", "03"].map((d) => ({ date: `2026-10-${d}`, done: 4, due: 4 })),
      ...["04", "05", "06"].map((d) => ({ date: `2026-10-${d}`, done: 1, due: 4 })),
      { date: "2026-10-07", done: 3, due: 5 },
    ];
    const scores = new Map(
      ["01", "02", "03", "04", "05", "06", "07"].map((d, i) => [
        `2026-10-${d}`,
        i < 3 ? 0.6 : -0.2,
      ]),
    );
    const result = moodByHabitDays(days, scores);
    expect(result.strong).toEqual({ mood: 0.6, days: 3 });
    expect(result.light?.days).toBe(3);
    expect(result.light?.mood).toBeCloseTo(-0.2);
  });

  it("says nothing about a group with too few days", () => {
    const result = moodByHabitDays(
      [{ date: "2026-10-01", done: 1, due: 1 }],
      new Map([["2026-10-01", 1]]),
    );
    expect(result).toEqual({ strong: null, light: null });
  });
});

describe("topWithOther", () => {
  it("keeps the busiest habits and folds the rest into Other", () => {
    const habits = [3, 9, 1, 7, 5].map((done, i) => ({ id: `h${i}`, done }));
    const { shown, other } = topWithOther(habits, 3);
    expect(shown.map((h) => h.done)).toEqual([9, 7]);
    expect(other.map((h) => h.done)).toEqual([5, 3, 1]);
    expect(topWithOther(habits, 8).other).toEqual([]);
  });
});
