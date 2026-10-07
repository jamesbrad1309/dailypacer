import { describe, expect, it } from "vitest";
import { dayStatus, entriesByDay, type HabitDays } from "#habits/day-status.util";

const base: HabitDays = {
  schedule: { type: "daily" },
  polarity: "build",
  targetValue: null,
  since: "2026-10-01",
  endDate: null,
  pauses: [],
  frozen: new Set(),
  entries: new Map(),
};
const entry = (date: string, completed: boolean, value: number | null = null) => ({
  date: new Date(date),
  completed,
  value,
});

describe("dayStatus", () => {
  it("reads a build habit's days", () => {
    // With a target, a value short of it is partly done.
    const habit = {
      ...base,
      targetValue: 5,
      entries: entriesByDay([entry("2026-10-02", true, 5), entry("2026-10-03", false, 2)]),
    };
    expect(dayStatus(habit, "2026-09-30", "2026-10-05")).toBe("NONE");
    expect(dayStatus(habit, "2026-10-02", "2026-10-05")).toBe("DONE");
    expect(dayStatus(habit, "2026-10-03", "2026-10-05")).toBe("PARTIAL");
    expect(dayStatus(habit, "2026-10-04", "2026-10-05")).toBe("MISSED");
    expect(dayStatus(habit, "2026-10-05", "2026-10-05")).toBe("DUE");
  });

  it("puts freezes and pauses before misses", () => {
    const habit = {
      ...base,
      frozen: new Set(["2026-10-02"]),
      pauses: [{ start: "2026-10-03", end: "2026-10-04" }],
    };
    expect(dayStatus(habit, "2026-10-02", "2026-10-05")).toBe("FROZEN");
    expect(dayStatus(habit, "2026-10-03", "2026-10-05")).toBe("PAUSED");
  });

  it("counts an avoid habit's days as done unless slipped", () => {
    const habit = {
      ...base,
      polarity: "avoid",
      entries: entriesByDay([entry("2026-10-02", false, 1)]),
    };
    expect(dayStatus(habit, "2026-10-01", "2026-10-05")).toBe("DONE");
    expect(dayStatus(habit, "2026-10-02", "2026-10-05")).toBe("SLIPPED");
    expect(dayStatus(habit, "2026-10-05", "2026-10-05")).toBe("DONE");
    expect(dayStatus(habit, "2026-10-06", "2026-10-05")).toBe("DUE");
  });

  it("never calls a day of a times-a-week habit missed", () => {
    const habit = { ...base, schedule: { type: "timesPerWeek" as const, count: 3 } };
    expect(dayStatus(habit, "2026-10-02", "2026-10-05")).toBe("OFF");
  });

  it("stops after a time-boxed habit's end", () => {
    expect(dayStatus({ ...base, endDate: "2026-10-03" }, "2026-10-04", "2026-10-05")).toBe("NONE");
  });
});
