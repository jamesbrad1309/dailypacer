import { describe, expect, it } from "vitest";
import type { DayCell, DayStatus } from "#habits/day-status.util";
import { addDays } from "#habits/day.util";
import { habitProgress } from "#habits/progress.util";

function cells(from: string, pattern: string): DayCell[] {
  const map: Record<string, DayStatus> = {
    D: "DONE",
    M: "MISSED",
    U: "DUE",
    F: "FROZEN",
    O: "OFF",
  };
  return [...pattern].map((ch, i) => ({ date: addDays(from, i), status: map[ch], value: null }));
}

describe("habitProgress", () => {
  // Two weeks from Mon 28 Sep; today is Wed 7 Oct, not ticked yet.
  const today = "2026-10-07";

  it("totals each week and each habit, leaving out frozen days and an unticked today", () => {
    const progress = habitProgress(
      [
        {
          id: "read",
          name: "Read",
          schedule: { type: "daily" },
          cells: cells("2026-09-28", "DDDDDDD" + "DMU"),
        },
        {
          id: "run",
          name: "Run",
          schedule: { type: "daily" },
          cells: cells("2026-09-28", "DMFDDDD" + "DDD"),
        },
      ],
      "2026-09-28",
      2,
      today,
    );
    expect(progress.weeks).toEqual([
      { weekStart: "2026-09-28", done: 12, due: 13, rate: 12 / 13 },
      { weekStart: "2026-10-05", done: 4, due: 5, rate: 4 / 5 },
    ]);
    expect(progress.habits[1]).toMatchObject({
      done: 8,
      due: 9,
      perWeek: [5, 3],
      perWeekDue: [6, 3],
    });
    expect(progress.days.find((d) => d.date === "2026-10-06")).toEqual({
      date: "2026-10-06",
      done: 1,
      due: 2,
    });
  });

  it("prorates a times-a-week habit's target for a week not over yet", () => {
    const progress = habitProgress(
      [
        {
          id: "gym",
          name: "Gym",
          schedule: { type: "timesPerWeek", count: 3 },
          cells: cells("2026-10-05", "DOOOOOO"),
        },
      ],
      "2026-10-05",
      1,
      today,
    );
    // Three of seven days tracked so far: due round(3 × 3 / 7) = 1, done 1.
    expect(progress.weeks[0]).toMatchObject({ done: 1, due: 1, rate: 1 });
  });
});
