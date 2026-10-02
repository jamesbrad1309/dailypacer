import { describe, expect, it } from "vitest";
import { computeMisses, statusOf, trackedSince } from "#habits/habit-records.util";
import { isPausedOn } from "#habits/pause.util";

const days = (...list: string[]) => new Set(list);

describe("statusOf / trackedSince", () => {
  it("is done, partly done (a value but not completed) or not done", () => {
    expect(statusOf({ completed: true, value: null })).toBe("DONE");
    expect(statusOf({ completed: false, value: 2 })).toBe("PARTIAL");
    expect(statusOf({ completed: false, value: null })).toBe("NOT_DONE");
  });

  it("starts from a backdated entry when there is one", () => {
    expect(trackedSince("2026-09-23", null)).toBe("2026-09-23");
    expect(trackedSince("2026-09-23", "2026-09-20")).toBe("2026-09-20");
    expect(trackedSince("2026-09-23", "2026-09-25")).toBe("2026-09-23");
  });
});

describe("isPausedOn", () => {
  it("covers the pause day up to, not including, the resume day", () => {
    const pauses = [{ start: "2026-09-03", end: "2026-09-05" }];
    expect(
      ["2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"].map((d) => isPausedOn(pauses, d)),
    ).toEqual([false, true, true, false]);
    expect(isPausedOn([{ start: "2026-09-03", end: null }], "2030-01-01")).toBe(true);
  });
});

describe("computeMisses: daily and weekday schedules", () => {
  const base = { since: "2026-09-01", today: "2026-09-06", pauses: [] };

  it("lists past due days with no entry, newest first, never today", () => {
    const misses = computeMisses({
      ...base,
      schedule: { type: "daily" },
      logged: days("2026-09-02", "2026-09-04"),
      completed: days("2026-09-02"),
    });
    expect(misses.map((m) => m.date)).toEqual(["2026-09-05", "2026-09-03", "2026-09-01"]);
  });

  it("only counts days the schedule makes due", () => {
    // Tue 1 Sep … Sat 5 Sep; Mon/Wed/Fri → Wed 2, Fri 4.
    const misses = computeMisses({
      ...base,
      schedule: { type: "weekly", daysOfWeek: [1, 3, 5] },
      logged: days(),
      completed: days(),
    });
    expect(misses.map((m) => m.date)).toEqual(["2026-09-04", "2026-09-02"]);
  });

  it("skips paused days", () => {
    const misses = computeMisses({
      ...base,
      schedule: { type: "daily" },
      logged: days(),
      completed: days(),
      pauses: [{ start: "2026-09-02", end: "2026-09-05" }],
    });
    expect(misses.map((m) => m.date)).toEqual(["2026-09-05", "2026-09-01"]);
  });
});

describe("computeMisses: times a week", () => {
  // Created Tue 1 Sep → first full week Mon 7 Sep. Today Wed 23 Sep.
  const base = {
    schedule: { type: "timesPerWeek", count: 3 } as const,
    since: "2026-09-01",
    today: "2026-09-23",
    logged: days(),
  };

  it("lists finished weeks under target, not single days", () => {
    const misses = computeMisses({
      ...base,
      completed: days("2026-09-07", "2026-09-09", "2026-09-11", "2026-09-15"),
      pauses: [],
    });
    expect(misses).toEqual([
      {
        date: "2026-09-20",
        status: "MISSED_WEEK",
        week: { start: "2026-09-14", end: "2026-09-20", done: 1, target: 3 },
      },
    ]);
  });

  it("doesn't judge a week the habit was paused in", () => {
    const misses = computeMisses({
      ...base,
      completed: days("2026-09-07", "2026-09-09", "2026-09-11"),
      pauses: [{ start: "2026-09-16", end: "2026-09-18" }],
    });
    expect(misses).toEqual([]);
  });
});
