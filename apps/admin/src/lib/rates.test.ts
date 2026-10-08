import { describe, expect, it } from "vitest";
import { formatRate, rateProblem } from "./rates";

describe("formatRate", () => {
  it("trims trailing zeros but keeps whole numbers", () => {
    expect(formatRate(1.17)).toBe("1.17");
    expect(formatRate(25000)).toBe("25000");
    expect(formatRate(100)).toBe("100");
    expect(formatRate(0.0000312345678)).toBe("0.0000312346");
    expect(formatRate(null)).toBe("—");
  });
});

describe("rateProblem", () => {
  it("accepts blank or a positive number", () => {
    expect(rateProblem("")).toBeNull();
    expect(rateProblem(" 1.2 ")).toBeNull();
    expect(rateProblem("0")).not.toBeNull();
    expect(rateProblem("-1")).not.toBeNull();
    expect(rateProblem("abc")).not.toBeNull();
  });
});
