import { describe, expect, it } from "vitest";
import { lifeLevel } from "#finance/life-xp.util";

describe("lifeLevel", () => {
  it("adds finance XP to habit points on the habits' level curve", () => {
    const life = lifeLevel(95, { underBudget: 2, goalsReached: 1, loggedWeeks: 3 });
    expect(life).toMatchObject({
      budgetXp: 50,
      goalXp: 100,
      loggingXp: 30,
      financeXp: 180,
      totalXp: 275,
      // Level 2 starts at 100 XP, level 3 at 300.
      level: 2,
      xpIntoLevel: 175,
      xpForNextLevel: 200,
    });
  });

  it("is just the habit level without any finance", () => {
    expect(lifeLevel(0, { underBudget: 0, goalsReached: 0, loggedWeeks: 0 })).toMatchObject({
      totalXp: 0,
      level: 1,
      levelTitle: "Beginner",
    });
  });
});
