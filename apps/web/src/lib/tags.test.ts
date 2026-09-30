import { describe, expect, it } from "vitest";
import { formatTags, parseTags } from "#lib/tags";

describe("parseTags", () => {
  it.each([
    ["holiday-2026, work-expense", ["holiday-2026", "work-expense"]],
    ["#holiday #work", ["holiday", "work"]],
    ["  Work,work , WORK ", ["work"]],
    ["a,,b", ["a", "b"]],
    ["", []],
    [" , # ", []],
  ])("%j → %j", (input, tags) => expect(parseTags(input)).toEqual(tags));

  it("caps the count and length at the API's limits", () => {
    const many = Array.from({ length: 25 }, (_, i) => `t${i}`).join(" ");
    expect(parseTags(many)).toHaveLength(20);
    expect(parseTags("x".repeat(60))[0]).toHaveLength(50);
  });

  it("round-trips through formatTags", () => {
    const tags = ["holiday-2026", "work"];
    expect(parseTags(formatTags(tags))).toEqual(tags);
  });
});
