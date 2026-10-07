import { describe, expect, it } from "vitest";
import { collectDeltas, isCounted, type TotalsRow } from "#finance/monthly-totals.service";

const row = (over: Partial<TotalsRow> = {}): TotalsRow => ({
  accountId: "acc",
  categoryId: "coffee",
  date: new Date("2026-09-25T00:00:00Z"),
  amountMinor: -340,
  transferId: null,
  source: "quick",
  ...over,
});

describe("isCounted", () => {
  it("leaves out transfers and balance adjustments", () => {
    expect(isCounted(row())).toBe(true);
    expect(isCounted(row({ transferId: "t1" }))).toBe(false);
    expect(isCounted(row({ source: "adjustment" }))).toBe(false);
  });
});

describe("collectDeltas", () => {
  it("files a transaction under the 1st of its month", () => {
    expect(collectDeltas([{ row: row(), sign: 1 }])).toEqual([
      {
        month: "2026-09-01",
        accountId: "acc",
        categoryId: "coffee",
        outflowMinor: 340,
        inflowMinor: 0,
        count: 1,
      },
    ]);
  });

  it("an edit that only changes the payee cancels out to nothing", () => {
    expect(
      collectDeltas([
        { row: row(), sign: -1 },
        { row: row(), sign: 1 },
      ]),
    ).toEqual([]);
  });

  it("an amount change stays in its bucket with count 0", () => {
    expect(
      collectDeltas([
        { row: row(), sign: -1 },
        { row: row({ amountMinor: -500 }), sign: 1 },
      ]),
    ).toEqual([expect.objectContaining({ outflowMinor: 160, inflowMinor: 0, count: 0 })]);
  });

  it("moving month or category is a removal and an addition", () => {
    const deltas = collectDeltas([
      { row: row(), sign: -1 },
      { row: row({ categoryId: null, date: new Date("2026-08-31T00:00:00Z") }), sign: 1 },
    ]);
    expect(deltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          month: "2026-09-01",
          categoryId: "coffee",
          outflowMinor: -340,
          count: -1,
        }),
        expect.objectContaining({
          month: "2026-08-01",
          categoryId: null,
          outflowMinor: 340,
          count: 1,
        }),
      ]),
    );
  });

  it("splits money in and out: a refund is inflow", () => {
    expect(collectDeltas([{ row: row({ amountMinor: 1200 }), sign: 1 }])[0]).toMatchObject({
      outflowMinor: 0,
      inflowMinor: 1200,
    });
  });
});

describe("collectDeltas with splits", () => {
  it("counts each part of a split in its own category", () => {
    const split = row({
      categoryId: null,
      amountMinor: -5200,
      splits: [
        { categoryId: "groceries", amountMinor: -4000 },
        { categoryId: "home", amountMinor: -1200 },
      ],
    });
    expect(collectDeltas([{ row: split, sign: 1 }])).toEqual([
      expect.objectContaining({ categoryId: "groceries", outflowMinor: 4000, count: 1 }),
      expect.objectContaining({ categoryId: "home", outflowMinor: 1200, count: 1 }),
    ]);
  });

  it("splitting a transaction moves its money out of the old category", () => {
    const before = row({ categoryId: "groceries", amountMinor: -5200 });
    const after = row({
      categoryId: null,
      amountMinor: -5200,
      splits: [
        { categoryId: "groceries", amountMinor: -4000 },
        { categoryId: "home", amountMinor: -1200 },
      ],
    });
    expect(
      collectDeltas([
        { row: before, sign: -1 },
        { row: after, sign: 1 },
      ]),
    ).toEqual([
      expect.objectContaining({ categoryId: "groceries", outflowMinor: -1200, count: 0 }),
      expect.objectContaining({ categoryId: "home", outflowMinor: 1200, count: 1 }),
    ]);
  });
});
