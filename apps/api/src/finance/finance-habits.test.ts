import { describe, expect, it } from "vitest";
import {
  type DayTransaction,
  LOGGED_TODAY,
  NO_SPEND,
  derivedEntry,
  financeLinkOf,
  isSpending,
  savedEntry,
  savedOnDay,
} from "#finance/finance-habits.util";

const tx = (overrides: Partial<DayTransaction> = {}): DayTransaction => ({
  amountMinor: -340,
  source: "quick",
  transferId: null,
  categoryId: "coffee",
  splits: [],
  ...overrides,
});

describe("financeLinkOf", () => {
  it("reads a known source, ignoring empty category lists", () => {
    expect(financeLinkOf({ source: NO_SPEND, categoryIds: [] })).toEqual({
      source: NO_SPEND,
      categoryIds: null,
    });
    expect(financeLinkOf({ source: NO_SPEND, categoryIds: ["a", 3] })?.categoryIds).toEqual(["a"]);
  });

  it("is null for ordinary habits", () => {
    expect(financeLinkOf({ fields: [] })).toBeNull();
    expect(financeLinkOf({ source: "finance.other" })).toBeNull();
    expect(financeLinkOf(null)).toBeNull();
  });
});

describe("isSpending", () => {
  it("counts money out, not money in, transfers or adjustments", () => {
    expect(isSpending(tx(), null)).toBe(true);
    expect(isSpending(tx({ amountMinor: 500 }), null)).toBe(false);
    expect(isSpending(tx({ transferId: "t" }), null)).toBe(false);
    expect(isSpending(tx({ source: "adjustment" }), null)).toBe(false);
  });

  it("limits to the chosen categories, a split counting by any part", () => {
    expect(isSpending(tx({ categoryId: "rent" }), ["coffee"])).toBe(false);
    expect(isSpending(tx(), ["coffee"])).toBe(true);
    const split = tx({
      categoryId: null,
      splits: [{ categoryId: "rent" }, { categoryId: "coffee" }],
    });
    expect(isSpending(split, ["coffee"])).toBe(true);
    expect(isSpending(split, ["food"])).toBe(false);
  });
});

describe("derivedEntry", () => {
  const noSpend = { source: NO_SPEND, categoryIds: null } as const;
  const loggedToday = { source: LOGGED_TODAY, categoryIds: null } as const;

  it("no-spend: one slip per spending transaction, 0 when clean", () => {
    expect(derivedEntry(noSpend, [tx(), tx(), tx({ amountMinor: 100 })], false)).toEqual({
      kind: "slips",
      value: 2,
    });
    expect(derivedEntry(noSpend, [], false)).toEqual({ kind: "slips", value: 0 });
  });

  it("logged today: done by a quick, form or adjustment entry, or a reconcile", () => {
    expect(derivedEntry(loggedToday, [tx({ source: "form" })], false)).toEqual({
      kind: "done",
      completed: true,
    });
    expect(derivedEntry(loggedToday, [tx({ source: "adjustment" })], false).kind).toBe("done");
    expect(
      derivedEntry(loggedToday, [tx({ source: "import" }), tx({ source: "recurring" })], false),
    ).toEqual({ kind: "done", completed: false });
    expect(derivedEntry(loggedToday, [], true)).toEqual({ kind: "done", completed: true });
  });
});

describe("savings habits", () => {
  it("savedOnDay: a linked goal nets its account's day; an unlinked one its contributions", () => {
    const day = [
      { accountId: "savings", amountMinor: 1000 },
      { accountId: "savings", amountMinor: -300 },
      { accountId: "current", amountMinor: -1000 },
    ];
    expect(savedOnDay({ accountId: "savings" }, day, [])).toBe(700);
    expect(savedOnDay({ accountId: null }, day, [{ amountMinor: 500 }, { amountMinor: 250 }])).toBe(
      750,
    );
  });

  it("savedEntry: major units against the target, never negative", () => {
    expect(savedEntry(1000, 2, 10)).toEqual({ value: 10, completed: true });
    expect(savedEntry(450, 2, 10)).toEqual({ value: 4.5, completed: false });
    expect(savedEntry(-500, 2, 10)).toEqual({ value: 0, completed: false });
    expect(savedEntry(50000, 0, 100000)).toEqual({ value: 50000, completed: false });
    expect(savedEntry(1, 2, null)).toEqual({ value: 0.01, completed: true });
  });
});
