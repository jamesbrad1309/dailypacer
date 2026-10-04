import { describe, expect, it } from "vitest";
import { goalProgress } from "#finance/savings-goal.util";

const goal = {
  targetMinor: 120_000,
  deadline: "2027-01-01",
  startDate: "2026-01-01",
  startSavedMinor: 0,
};

describe("goalProgress", () => {
  it("without a deadline, only reports the amounts", () => {
    const p = goalProgress({ ...goal, deadline: null }, 30_000, "2026-06-01");
    expect(p).toMatchObject({ remainingMinor: 90_000, progress: 0.25, achieved: false });
    expect(p.requiredPerMonthMinor).toBeNull();
    expect(p.onTrack).toBeNull();
  });

  it("is on track when saving keeps up with the time gone", () => {
    // About half the year gone; half saved.
    const p = goalProgress(goal, 61_000, "2026-07-02");
    expect(p.onTrack).toBe(true);
    // Six months left for 59,000.
    expect(p.requiredPerMonthMinor).toBeGreaterThan(9_500);
    expect(p.requiredPerMonthMinor).toBeLessThan(10_000);
  });

  it("is behind when saving lags, measured from what was saved at the start", () => {
    expect(goalProgress(goal, 40_000, "2026-07-02").onTrack).toBe(false);
    const fromBalance = { ...goal, startSavedMinor: 60_000 };
    // Halfway from 60,000 to 120,000 is 90,000.
    expect(goalProgress(fromBalance, 85_000, "2026-07-02").onTrack).toBe(false);
    expect(goalProgress(fromBalance, 92_000, "2026-07-02").onTrack).toBe(true);
  });

  it("asks for the rest in the last month, and all of it once overdue", () => {
    expect(goalProgress(goal, 100_000, "2026-12-20").requiredPerMonthMinor).toBe(20_000);
    const late = goalProgress(goal, 100_000, "2027-02-01");
    expect(late).toMatchObject({ overdue: true, onTrack: false, requiredPerMonthMinor: 20_000 });
  });

  it("is done once the target is reached", () => {
    const p = goalProgress(goal, 125_000, "2026-03-01");
    expect(p).toMatchObject({ achieved: true, remainingMinor: 0, requiredPerMonthMinor: 0 });
    expect(p.onTrack).toBe(true);
  });
});
