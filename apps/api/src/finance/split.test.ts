import { describe, expect, it } from "vitest";
import { splitProblem } from "#finance/split.util";

const part = (categoryId: string, amountMinor: number) => ({ categoryId, amountMinor });

describe("splitProblem", () => {
  it("accepts parts that add up exactly, with the transaction's sign", () => {
    expect(splitProblem(-5200, [part("groceries", -4000), part("home", -1200)])).toBeNull();
    expect(splitProblem(3000, [part("salary", 2000), part("gifts", 1000)])).toBeNull();
  });

  it("refuses a single part, a wrong total and a part of the other sign", () => {
    expect(splitProblem(-5200, [part("groceries", -5200)])).toMatch(/at least two/);
    expect(splitProblem(-5200, [part("a", -4000), part("b", -1000)])).toMatch(/add up to -5000/);
    expect(splitProblem(-5200, [part("a", -6200), part("b", 1000)])).toMatch(/money out/);
    expect(splitProblem(-5200, [part("a", -5200), part("b", 0)])).toMatch(/money out/);
  });
});
