import { describe, expect, it } from "vitest";
import { computeCurrentStreak } from "#habits/streak.util";

const done = (...days: string[]) =>
  days.map((d) => ({ date: new Date(`${d}T00:00:00Z`), completed: true, value: null }));
const today = new Date(2026, 9, 5, 12);

describe("computeCurrentStreak", () => {
  it("doesn't break on today while it isn't done yet", () => {
    const entries = done("2026-10-02", "2026-10-03", "2026-10-04");
    expect(computeCurrentStreak({ type: "daily" }, entries, null, today, 30)).toBe(3);
  });

  it("counts today once it's done", () => {
    const entries = done("2026-10-03", "2026-10-04", "2026-10-05");
    expect(computeCurrentStreak({ type: "daily" }, entries, null, today, 30)).toBe(3);
  });

  it("breaks on a missed day before today", () => {
    const entries = done("2026-10-02", "2026-10-04");
    expect(computeCurrentStreak({ type: "daily" }, entries, null, today, 30)).toBe(1);
  });

  it("breaks on a slip today", () => {
    const entries = [
      ...done("2026-10-03", "2026-10-04"),
      { date: new Date("2026-10-05T00:00:00Z"), completed: false, value: null, slip: true },
    ];
    expect(computeCurrentStreak({ type: "daily" }, entries, null, today, 30)).toBe(0);
  });
});
