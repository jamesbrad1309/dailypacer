import { describe, expect, it } from "vitest";
import { SHORTCUTS, displayKeys, goToKeysFor } from "#lib/shortcuts";

describe("displayKeys", () => {
  it("shows ⌘-style symbols on a Mac and words elsewhere", () => {
    expect(displayKeys("$mod+Shift+P", true)).toEqual(["⌘", "⇧", "P"]);
    expect(displayKeys("$mod+Shift+P", false)).toEqual(["Ctrl", "Shift", "P"]);
  });

  it("splits sequences and drops the Shift a symbol is typed with", () => {
    expect(displayKeys("g h", true)).toEqual(["G", "H"]);
    expect(displayKeys("Shift+?", false)).toEqual(["?"]);
    expect(displayKeys("ArrowLeft", true)).toEqual(["←"]);
  });
});

describe("SHORTCUTS", () => {
  it("never binds the same keys twice", () => {
    const bound = SHORTCUTS.filter((s) => !s.pageOnly && s.group !== "palette").flatMap(
      (s) => s.keys,
    );
    expect(new Set(bound).size).toBe(bound.length);
  });

  it("has go-to sequences for the main pages", () => {
    expect(goToKeysFor("/habits")).toBe("g h");
    expect(goToKeysFor("/progress")).toBe("g p");
  });
});
