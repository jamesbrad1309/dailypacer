import { describe, expect, it } from "vitest";
import {
  PREFIX_PATTERN,
  addDays,
  completedAtFor,
  formatKey,
  parseKey,
  positionBetween,
  suggestPrefix,
  wouldCreateCycle,
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

describe("wouldCreateCycle", () => {
  // a waits for b, b waits for c.
  const edges = new Map([
    ["a", ["b"]],
    ["b", ["c"]],
  ]);

  it("refuses a task waiting for itself", () => {
    expect(wouldCreateCycle("a", "a", edges)).toBe(true);
  });

  it("refuses closing a loop, directly or through others", () => {
    expect(wouldCreateCycle("b", "a", edges)).toBe(true); // b → a → b
    expect(wouldCreateCycle("c", "a", edges)).toBe(true); // c → a → b → c
  });

  it("allows chains and shared dependencies", () => {
    expect(wouldCreateCycle("a", "c", edges)).toBe(false);
    expect(wouldCreateCycle("d", "a", edges)).toBe(false);
  });
});

describe("completedAtFor", () => {
  const now = new Date("2026-10-04T10:00:00Z");
  const before = new Date("2026-10-01T09:00:00Z");

  it("stamps a task that becomes done, and clears one that stops being done", () => {
    expect(completedAtFor("TODO", "DONE", null, now)).toBe(now);
    expect(completedAtFor("DONE", "IN_PROGRESS", before, now)).toBeNull();
  });

  it("keeps the time when moving between two Done columns", () => {
    expect(completedAtFor("DONE", "DONE", before, now)).toBe(before);
  });
});

describe("addDays", () => {
  it("crosses month ends in UTC", () => {
    expect(addDays("2026-10-30", 3).toISOString().slice(0, 10)).toBe("2026-11-02");
  });
});
