import { describe, expect, it } from "vitest";
import {
  PREFIX_PATTERN,
  formatKey,
  parseKey,
  positionBetween,
  suggestPrefix,
} from "#todos/todo.util";

describe("suggestPrefix", () => {
  it("takes the name's first three letters", () => {
    expect(suggestPrefix("Grocery list", new Set())).toBe("GRO");
    expect(suggestPrefix("Đi chợ", new Set())).toBe("DIC");
    expect(suggestPrefix("2026 goals", new Set())).toBe("GOA");
  });

  it("numbers it when taken, and falls back to LIST", () => {
    expect(suggestPrefix("Groceries", new Set(["GRO"]))).toBe("GRO2");
    expect(suggestPrefix("Groceries", new Set(["GRO", "GRO2"]))).toBe("GRO3");
    expect(suggestPrefix("!!", new Set())).toBe("LIST");
  });

  it("always suggests a valid prefix", () => {
    for (const name of ["Grocery list", "Đi chợ", "x", "Home repairs 2026"]) {
      expect(suggestPrefix(name, new Set())).toMatch(PREFIX_PATTERN);
    }
  });
});

describe("keys", () => {
  it("formats and parses, case-insensitively", () => {
    expect(formatKey("GRO", 12)).toBe("GRO-12");
    expect(parseKey("gro-12")).toEqual({ prefix: "GRO", number: 12 });
    expect(parseKey("GRO12")).toBeNull();
    expect(parseKey("-12")).toBeNull();
  });
});

describe("positionBetween", () => {
  it("goes between neighbours, or past the end", () => {
    expect(positionBetween(null, null)).toBe(0);
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(null, 3)).toBe(2);
    expect(positionBetween(3, null)).toBe(4);
  });
});
