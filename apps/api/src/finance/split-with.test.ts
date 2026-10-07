import { describe, expect, it } from "vitest";
import { equalShares, myShare, shareProblem } from "#finance/split-with.util";

const sam = "a0000000-0000-4000-8000-000000000001";
const alex = "a0000000-0000-4000-8000-000000000002";

describe("split with", () => {
  it("accepts shares that leave you one", () => {
    expect(shareProblem(5000, [{ accountId: sam, amountMinor: 2500 }])).toBeNull();
    expect(myShare(5000, [{ accountId: sam, amountMinor: 2500 }])).toBe(2500);
  });

  it("refuses an empty, duplicate, zero or whole-bill split", () => {
    expect(shareProblem(5000, [])).toMatch(/at least one/);
    expect(
      shareProblem(5000, [
        { accountId: sam, amountMinor: 1000 },
        { accountId: sam, amountMinor: 1000 },
      ]),
    ).toMatch(/one share/);
    expect(shareProblem(5000, [{ accountId: sam, amountMinor: 0 }])).toMatch(/more than zero/);
    expect(
      shareProblem(5000, [
        { accountId: sam, amountMinor: 2500 },
        { accountId: alex, amountMinor: 2500 },
      ]),
    ).toMatch(/leave you a share/);
  });

  it("splits evenly, you taking the leftover pennies", () => {
    expect(equalShares(5000, 1)).toEqual({ each: 2500, mine: 2500 });
    expect(equalShares(1000, 2)).toEqual({ each: 333, mine: 334 });
    expect(equalShares(1, 1)).toEqual({ each: 0, mine: 1 });
  });
});
