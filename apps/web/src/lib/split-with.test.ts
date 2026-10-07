import { describe, expect, it } from "vitest";
import { EMPTY_SPLIT, splitShares } from "#lib/split-with";

describe("splitShares", () => {
  it("splits evenly, you taking the leftover pennies", () => {
    const result = splitShares({ ...EMPTY_SPLIT, people: ["sam", "alex"] }, 1000, "GBP");
    expect(result.shares.map((s) => s.amountMinor)).toEqual([333, 333]);
    expect(result).toMatchObject({ mineMinor: 334, problem: null });
  });

  it("uses typed amounts, and says what's wrong with them", () => {
    const draft = { people: ["sam"], custom: true, amounts: { sam: "30" } };
    expect(splitShares(draft, 5000, "GBP")).toMatchObject({ mineMinor: 2000, problem: null });
    expect(splitShares({ ...draft, amounts: {} }, 5000, "GBP").problem).toBe("enterShares");
    expect(splitShares({ ...draft, amounts: { sam: "50" } }, 5000, "GBP").problem).toBe("tooMuch");
  });

  it("needs someone to split with", () => {
    expect(splitShares(EMPTY_SPLIT, 5000, "GBP").problem).toBe("noPeople");
  });
});
