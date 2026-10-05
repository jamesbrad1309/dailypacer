import { describe, expect, it } from "vitest";
import { avoidEntries, isSlip } from "#habits/polarity.util";

const day = (d: string) => new Date(d);

describe("isSlip", () => {
  it("is a not-done entry with slips logged", () => {
    expect(isSlip({ completed: false, value: 1 })).toBe(true);
    expect(isSlip({ completed: false, value: 0 })).toBe(false);
    expect(isSlip({ completed: true, value: 2 })).toBe(false);
    expect(isSlip({ completed: false, value: null })).toBe(false);
  });
});

describe("avoidEntries", () => {
  it("counts every due day without a slip as done, from the start day through today", () => {
    const entries = avoidEntries([{ date: day("2026-10-02"), completed: false, value: 1 }], {
      schedule: { type: "daily" },
      since: "2026-10-01",
      today: "2026-10-04",
      pauses: [],
    });
    expect(entries.map((e) => [e.date.toISOString().slice(0, 10), e.completed])).toEqual([
      ["2026-10-01", true],
      ["2026-10-02", false],
      ["2026-10-03", true],
      ["2026-10-04", true],
    ]);
  });

  it("skips paused and not-due days", () => {
    const entries = avoidEntries([], {
      schedule: { type: "daily" },
      since: "2026-10-01",
      today: "2026-10-03",
      pauses: [{ start: "2026-10-02", end: "2026-10-03" }],
    });
    expect(entries.map((e) => e.date.toISOString().slice(0, 10))).toEqual([
      "2026-10-01",
      "2026-10-03",
    ]);
  });
});
