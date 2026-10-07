import { describe, expect, it } from "vitest";
import {
  chargesBetween,
  isChargeDate,
  monthlyCost,
  nextCharge,
  nthCharge,
  priceOn,
  type Schedule,
  yearlyCost,
} from "#finance/subscription-schedule.util";

const monthly = (firstChargeOn: string, extra: Partial<Schedule> = {}): Schedule => ({
  interval: "MONTH",
  intervalCount: 1,
  firstChargeOn,
  endsOn: null,
  ...extra,
});

describe("nthCharge", () => {
  it("keeps the anchor's day, clamping short months without drifting", () => {
    const s = monthly("2026-01-31");
    expect([0, 1, 2, 3].map((n) => nthCharge(s, n))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("handles leap days for yearly charges", () => {
    const s: Schedule = { ...monthly("2028-02-29"), interval: "YEAR" };
    expect(nthCharge(s, 1)).toBe("2029-02-28");
    expect(nthCharge(s, 4)).toBe("2032-02-29");
  });

  it("steps weeks and multi-month intervals", () => {
    expect(nthCharge({ ...monthly("2026-09-30"), interval: "WEEK", intervalCount: 2 }, 3)).toBe(
      "2026-11-11",
    );
    expect(nthCharge(monthly("2026-01-15", { intervalCount: 3 }), 2)).toBe("2026-07-15");
  });
});

describe("chargesBetween", () => {
  it("lists charges in an inclusive range", () => {
    expect(chargesBetween(monthly("2026-01-05"), "2026-03-05", "2026-05-04")).toEqual([
      "2026-03-05",
      "2026-04-05",
    ]);
  });

  it("has nothing before the first charge (e.g. during a free trial)", () => {
    expect(chargesBetween(monthly("2026-10-14"), "2026-09-01", "2026-10-13")).toEqual([]);
  });

  it("stops before endsOn", () => {
    const s = monthly("2026-01-10", { endsOn: "2026-03-10" });
    expect(chargesBetween(s, "2026-01-01", "2026-12-31")).toEqual(["2026-01-10", "2026-02-10"]);
  });

  it("walks a long history quickly and correctly", () => {
    const s = { ...monthly("2020-01-01"), interval: "WEEK" as const };
    expect(chargesBetween(s, "2026-09-01", "2026-09-30")).toEqual([
      "2026-09-02",
      "2026-09-09",
      "2026-09-16",
      "2026-09-23",
      "2026-09-30",
    ]);
  });
});

describe("nextCharge", () => {
  it("is today when a charge is due today", () => {
    expect(nextCharge(monthly("2026-01-30"), "2026-09-30")).toBe("2026-09-30");
  });

  it("is the anchor while it's still ahead", () => {
    expect(nextCharge(monthly("2026-12-01"), "2026-09-30")).toBe("2026-12-01");
  });

  it("is null once cancelled", () => {
    // endsOn is exclusive: a charge falling on it never happens.
    expect(nextCharge(monthly("2026-01-15", { endsOn: "2026-10-15" }), "2026-09-30")).toBeNull();
    expect(nextCharge(monthly("2026-01-15", { endsOn: "2026-10-16" }), "2026-09-30")).toBe(
      "2026-10-15",
    );
  });
});

describe("isChargeDate", () => {
  it("accepts only real charge dates", () => {
    const s = monthly("2026-01-31");
    expect(isChargeDate(s, "2026-02-28")).toBe(true);
    expect(isChargeDate(s, "2026-02-27")).toBe(false);
  });
});

describe("priceOn", () => {
  const prices = [
    { amountMinor: 1099, effectiveFrom: "2026-01-01" },
    { amountMinor: 1199, effectiveFrom: "2026-03-01" },
  ];

  it("uses the price in effect on the day", () => {
    expect(priceOn(prices, "2026-02-28")).toBe(1099);
    expect(priceOn(prices, "2026-03-01")).toBe(1199);
  });

  it("uses the first price for dates before any", () => {
    expect(priceOn(prices, "2025-06-01")).toBe(1099);
  });
});

describe("costs", () => {
  it.each([
    [999, "MONTH", 1, 11988, 999],
    [12000, "YEAR", 1, 12000, 1000],
    [300, "WEEK", 1, 15600, 1300],
    [2997, "MONTH", 3, 11988, 999],
  ] as const)("%d per %s×%d → %d/yr, %d/mo", (amount, interval, count, year, month) => {
    expect(yearlyCost(amount, interval, count)).toBe(year);
    expect(monthlyCost(amount, interval, count)).toBe(month);
  });
});
