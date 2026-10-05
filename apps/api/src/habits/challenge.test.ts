import { describe, expect, it } from "vitest";
import { challengeBonus, challengeProgress } from "#habits/challenge.util";

const week = { startDate: "2026-10-05", endDate: "2026-10-11", target: 5, multiplier: 2 };
const done = (...days: string[]) => new Set(days);

describe("challengeProgress", () => {
  it("is active until the target is met, then won with the bonus", () => {
    expect(challengeProgress(week, done("2026-10-05", "2026-10-06"), "2026-10-07")).toEqual({
      done: 2,
      status: "ACTIVE",
      bonusPoints: 0,
    });
    const five = done("2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09");
    expect(challengeProgress(week, five, "2026-10-09")).toEqual({
      done: 5,
      status: "WON",
      bonusPoints: 50,
    });
  });

  it("is lost once it ends short, and upcoming before it starts", () => {
    expect(challengeProgress(week, done("2026-10-05"), "2026-10-12").status).toBe("LOST");
    expect(challengeProgress(week, done(), "2026-10-01").status).toBe("UPCOMING");
  });

  it("only counts check-ins inside the range", () => {
    expect(challengeProgress(week, done("2026-10-04", "2026-10-12"), "2026-10-08").done).toBe(0);
  });
});

describe("challengeBonus", () => {
  it("adds the bonus of every won challenge", () => {
    const days = done("2026-10-05", "2026-10-06");
    const easy = { ...week, target: 2, multiplier: 3 };
    expect(challengeBonus([week, easy], days, "2026-10-12")).toBe(40);
  });
});
