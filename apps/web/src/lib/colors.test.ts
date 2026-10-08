import { describe, expect, it } from "vitest";
import { withAlpha } from "#lib/colors";

describe("withAlpha", () => {
  it("appends the alpha as a hex byte", () => {
    expect(withAlpha("#3e63dd", 1)).toBe("#3e63ddff");
    expect(withAlpha("#3e63dd", 0.45)).toBe("#3e63dd73");
    expect(withAlpha("#3e63dd", 0)).toBe("#3e63dd00");
  });

  it("clamps the alpha to 0–1", () => {
    expect(withAlpha("#3e63dd", 2)).toBe("#3e63ddff");
    expect(withAlpha("#3e63dd", -1)).toBe("#3e63dd00");
  });

  it("leaves anything but #rrggbb alone", () => {
    expect(withAlpha("red", 0.5)).toBe("red");
    expect(withAlpha("#fff", 0.5)).toBe("#fff");
  });
});
