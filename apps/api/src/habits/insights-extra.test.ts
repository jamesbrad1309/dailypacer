import { describe, expect, it } from "vitest";
import { achievements } from "#habits/achievements.util";
import { correlations } from "#habits/correlations.util";
import type { DayCell, DayStatus } from "#habits/day-status.util";
import { addDays } from "#habits/day.util";
import { weeklyReview } from "#habits/weekly-review.util";

/** Cells from `from`, one status per character: D done, M missed, O off, F frozen, U due. */
function cells(from: string, pattern: string, values: (number | null)[] = []): DayCell[] {
  const map: Record<string, DayStatus> = {
    D: "DONE",
    M: "MISSED",
    O: "OFF",
    F: "FROZEN",
    U: "DUE",
  };
  return [...pattern].map((ch, i) => ({
    date: addDays(from, i),
    status: map[ch],
    value: values[i] ?? null,
  }));
}

describe("achievements", () => {
  it("finds the first check-in, a 7-day streak through a frozen day, and a perfect week", () => {
    // Mon 2026-09-28 … Sun 2026-10-04 all done, with a freeze on Thursday.
    const list = achievements({
      habits: [{ cells: cells("2026-09-28", "DDDFDDDD") }],
      level: 2,
      challengeWins: [],
      today: "2026-10-06",
    });
    const get = (key: string) => list.find((a) => a.key === key);
    expect(get("FIRST_CHECK_IN")).toMatchObject({ unlocked: true, achievedOn: "2026-09-28" });
    expect(get("STREAK_7")).toMatchObject({ unlocked: true, achievedOn: "2026-10-05" });
    expect(get("PERFECT_WEEK")).toMatchObject({ unlocked: true, achievedOn: "2026-10-04" });
    expect(get("STREAK_30")).toMatchObject({ unlocked: false, progress: 7 });
    expect(get("LEVEL_5")).toMatchObject({ unlocked: false, progress: 2 });
  });

  it("a miss resets the streak and spoils the week", () => {
    const list = achievements({
      habits: [{ cells: cells("2026-09-28", "DDDMDDD") }],
      level: 1,
      challengeWins: [],
      today: "2026-10-06",
    });
    expect(list.find((a) => a.key === "STREAK_7")?.progress).toBe(3);
    expect(list.find((a) => a.key === "PERFECT_WEEK")?.unlocked).toBe(false);
  });
});

describe("weeklyReview", () => {
  const habit = (id: string, pattern: string, currentStreak = 0) => ({
    id,
    name: id,
    schedule: { type: "daily" as const },
    currentStreak,
    cells: cells("2026-09-28", pattern),
  });

  it("totals the week against the one before and finds wins, misses and the best day", () => {
    const review = weeklyReview(
      [habit("read", "DDDDDDD" + "DDDDDDD"), habit("run", "DMDMDMD" + "DDMDDDD")],
      "2026-10-05",
      "2026-10-12",
    );
    expect(review.complete).toBe(true);
    expect(review.totals).toEqual({ done: 13, due: 14, rate: 13 / 14 });
    expect(review.previous).toEqual({ done: 11, due: 14, rate: 11 / 14 });
    expect(review.wins).toEqual(["read"]);
    expect(review.habits[1].missed).toEqual(["2026-10-07"]);
    expect(review.bestDay).toEqual({ date: "2026-10-05", done: 2 });
  });

  it("lists streaks at risk today, only during the week", () => {
    const review = weeklyReview([habit("read", "DDDDDDD" + "DDU", 9)], "2026-10-05", "2026-10-07");
    expect(review.complete).toBe(false);
    expect(review.atRisk).toEqual([{ id: "read", name: "read", currentStreak: 9 }]);
  });
});

describe("correlations", () => {
  it("finds a habit done more often on days another is done", () => {
    // Exercise and sleep-well done together on 6 days, both missed on 6.
    const pattern = "DDDDDDMMMMMM";
    const found = correlations(
      [
        {
          id: "exercise",
          name: "Exercise",
          quantified: false,
          cells: cells("2026-09-01", pattern),
        },
        { id: "sleep", name: "Sleep well", quantified: false, cells: cells("2026-09-01", pattern) },
      ],
      "2026-10-01",
    );
    expect(found[0]).toMatchObject({
      habitId: "exercise",
      otherId: "sleep",
      kind: "RATE",
      withValue: 1,
      withoutValue: 0,
    });
  });

  it("compares a quantified habit's values, and ignores thin evidence", () => {
    const exercise = cells("2026-09-01", "DDDDDDMMMMMM");
    const sleep = cells("2026-09-01", "DDDDDDDDDDDD", [8, 8, 8, 8, 8, 8, 6, 6, 6, 6, 6, 6]);
    const found = correlations(
      [
        { id: "exercise", name: "Exercise", quantified: false, cells: exercise },
        { id: "sleep", name: "Sleep", quantified: true, cells: sleep },
      ],
      "2026-10-01",
    );
    expect(found.find((c) => c.otherId === "sleep")).toMatchObject({
      kind: "VALUE",
      withValue: 8,
      withoutValue: 6,
    });
    const thin = correlations(
      [
        { id: "a", name: "A", quantified: false, cells: cells("2026-09-01", "DDM") },
        { id: "b", name: "B", quantified: false, cells: cells("2026-09-01", "DDM") },
      ],
      "2026-10-01",
    );
    expect(thin).toEqual([]);
  });
});
