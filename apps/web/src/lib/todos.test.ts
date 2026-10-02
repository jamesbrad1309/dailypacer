import { describe, expect, it } from "vitest";
import { PREFIX_PATTERN, positionBetween } from "#lib/todos";

describe("positionBetween", () => {
  it("goes between neighbours, or past either end", () => {
    expect(positionBetween(null, null)).toBe(0);
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(null, 3)).toBe(2);
    expect(positionBetween(3, null)).toBe(4);
  });
});

describe("PREFIX_PATTERN", () => {
  it("accepts 2–6 uppercase characters starting with a letter", () => {
    expect(["GRO", "Q4", "HOME12"].every((p) => PREFIX_PATTERN.test(p))).toBe(true);
    expect(["G", "4Q", "gro", "TOOLONG", "GR-O"].some((p) => PREFIX_PATTERN.test(p))).toBe(false);
  });
});
