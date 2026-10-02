import { describe, expect, it } from "vitest";
import type { HabitEntryRecord } from "#graphql/types";
import { habitRecordRows, statusOf, trackedSince } from "#lib/habit-records";

const entry = (date: string, over: Partial<HabitEntryRecord> = {}): HabitEntryRecord => ({
  id: date,
  date,
  value: null,
  completed: true,
  note: null,
  ...over,
});

describe("statusOf", () => {
  it("is done, partly done (a value but not completed) or not done", () => {
    expect(statusOf(entry("2026-09-01"))).toBe("done");
    expect(statusOf(entry("2026-09-01", { completed: false, value: 3 }))).toBe("partial");
    expect(statusOf(entry("2026-09-01", { completed: false, note: "skipped" }))).toBe("notDone");
  });
});

describe("habitRecordRows", () => {
  const base = { createdAt: "2026-09-01T08:00:00", today: "2026-09-06" };

  it("lists stored entries newest first", () => {
    const rows = habitRecordRows([entry("2026-09-02"), entry("2026-09-04")], {
      ...base,
      schedule: { type: "daily" },
      includeMissed: false,
    });
    expect(rows.map((r) => r.date)).toEqual(["2026-09-04", "2026-09-02"]);
  });

  it("adds past due days with no entry as missed, from creation until yesterday", () => {
    const rows = habitRecordRows([entry("2026-09-02"), entry("2026-09-04")], {
      ...base,
      schedule: { type: "daily" },
      includeMissed: true,
    });
    expect(rows.map((r) => `${r.date} ${r.status}`)).toEqual([
      "2026-09-05 missed",
      "2026-09-04 done",
      "2026-09-03 missed",
      "2026-09-02 done",
      "2026-09-01 missed",
    ]);
  });

  it("starts from an entry logged before the habit was created", () => {
    const rows = habitRecordRows([entry("2026-08-30")], {
      ...base,
      today: "2026-09-02",
      schedule: { type: "daily" },
      includeMissed: true,
    });
    expect(rows.map((r) => `${r.date} ${r.status}`)).toEqual([
      "2026-09-01 missed",
      "2026-08-31 missed",
      "2026-08-30 done",
    ]);
  });

  it("only counts days the schedule makes due", () => {
    // 2026-09-01 is a Tuesday; Mon/Wed/Fri only → Wed 2nd, Fri 4th.
    const rows = habitRecordRows([], {
      ...base,
      schedule: { type: "weekly", daysOfWeek: [1, 3, 5] },
      includeMissed: true,
    });
    expect(rows.map((r) => r.date)).toEqual(["2026-09-04", "2026-09-02"]);
  });

  it("lists times-a-week habits' finished weeks that fell short, not single days", () => {
    // Created Tue 1 Sep → first full week Mon 7 Sep. Today Wed 23 Sep → weeks of
    // 7 and 14 Sep are over; this week isn't.
    const rows = habitRecordRows(
      [
        entry("2026-09-02"), // part-way first week: never judged
        entry("2026-09-07"),
        entry("2026-09-09"),
        entry("2026-09-11"), // week of 7 Sep: 3 of 3, met
        entry("2026-09-15"),
        entry("2026-09-17", { completed: false, value: 1 }), // week of 14 Sep: 1 of 3
        entry("2026-09-21"),
      ],
      {
        createdAt: "2026-09-01T08:00:00",
        today: "2026-09-23",
        schedule: { type: "timesPerWeek", count: 3 },
        includeMissed: true,
      },
    );
    const missed = rows.filter((r) => r.status === "missedWeek");
    expect(missed).toEqual([
      {
        date: "2026-09-20",
        status: "missedWeek",
        week: { start: "2026-09-14", end: "2026-09-20", done: 1, target: 3 },
      },
    ]);
    expect(rows.filter((r) => r.status === "missed")).toEqual([]);
  });
});

describe("trackedSince", () => {
  it("is the creation date, or an earlier entry's", () => {
    expect(trackedSince("2026-09-23T10:00:00", [])).toBe("2026-09-23");
    expect(trackedSince("2026-09-23T10:00:00", [entry("2026-09-25"), entry("2026-09-20")])).toBe(
      "2026-09-20",
    );
  });
});
