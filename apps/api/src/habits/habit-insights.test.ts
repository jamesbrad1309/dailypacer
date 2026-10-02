import { describe, expect, it } from "vitest";
import { addDays } from "#habits/day.util";
import { habitInsights } from "#habits/habit-insights.util";

/** Every date in [from, to] whose Monday-first weekday is in `weekdays`. */
function daysOn(from: string, to: string, weekdays: number[]): Set<string> {
  const out = new Set<string>();
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const index = (new Date(`${day}T12:00:00`).getDay() + 6) % 7;
    if (weekdays.includes(index)) out.add(day);
  }
  return out;
}

describe("habitInsights: weekdays", () => {
  const today = "2026-10-02"; // a Friday
  const base = { schedule: { type: "daily" } as const, since: "2026-01-01", today, pauses: [] };

  it("finds the best and worst weekday over twelve weeks", () => {
    // Done every day except Fridays (index 4) and most Sundays.
    const completed = daysOn("2026-07-10", today, [0, 1, 2, 3, 5]);
    for (const sunday of [...daysOn("2026-07-10", today, [6])].slice(0, 3)) completed.add(sunday);
    const result = habitInsights({ ...base, completed });
    expect(result.worst).toBe(4);
    expect([0, 1, 2, 3, 5]).toContain(result.best);
    expect(result.weekdays[4].rate).toBe(0);
  });

  it("doesn't name a best or worst day when every day is the same", () => {
    const result = habitInsights({
      ...base,
      completed: daysOn("2026-07-01", today, [0, 1, 2, 3, 4, 5, 6]),
    });
    expect(result.best).toBeNull();
    expect(result.worst).toBeNull();
  });

  it("ignores days before tracking began and paused days", () => {
    const result = habitInsights({
      ...base,
      since: "2026-09-28",
      completed: new Set(["2026-09-28", "2026-09-29"]),
      pauses: [{ start: "2026-09-30", end: "2026-10-02" }],
    });
    // Mon 28, Tue 29 done; Wed 30, Thu 1 paused; Fri 2 (today) not done yet.
    expect(result.weekdays.map((s) => s.due)).toEqual([1, 1, 0, 0, 0, 0, 0]);
  });
});

describe("habitInsights: months", () => {
  it("compares this month so far with the whole of last month", () => {
    const result = habitInsights({
      schedule: { type: "daily" },
      since: "2026-01-01",
      today: "2026-10-02",
      pauses: [],
      completed: new Set([
        "2026-10-01",
        ...daysOn("2026-09-01", "2026-09-15", [0, 1, 2, 3, 4, 5, 6]),
      ]),
    });
    // Oct: 1 Oct done, 2 Oct (today) not yet → 1 of 1. Sep: 15 of 30.
    expect(result.thisMonth).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-02",
      due: 1,
      done: 1,
      rate: 1,
    });
    expect(result.lastMonth).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-30",
      due: 30,
      done: 15,
      rate: 0.5,
    });
  });

  it("measures times-a-week habits against the weekly target", () => {
    const result = habitInsights({
      schedule: { type: "timesPerWeek", count: 3 },
      since: "2026-01-01",
      today: "2026-10-02",
      pauses: [],
      // 6 check-ins in September: 30 days ≈ 4.3 weeks × 3 ≈ 13 expected.
      completed: new Set([
        "2026-09-01",
        "2026-09-03",
        "2026-09-08",
        "2026-09-10",
        "2026-09-15",
        "2026-09-17",
      ]),
    });
    expect(result.lastMonth).toMatchObject({ due: 13, done: 6 });
  });
});
