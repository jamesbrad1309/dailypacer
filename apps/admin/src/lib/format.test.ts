import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, formatUptime } from "./format";

describe("formatMoney", () => {
  it("reads minor units in the currency's own digits", () => {
    expect(formatMoney(123433, "GBP")).toBe("£1,234.33");
    expect(formatMoney(-4000, "GBP")).toBe("-£40.00");
    expect(formatMoney(50000, "VND")).toBe("₫50,000");
  });
});

describe("formatDate", () => {
  it("takes a day or a timestamp", () => {
    expect(formatDate("2026-10-08")).toBe("8 Oct 2026");
    expect(formatDate("2026-10-08T12:00:00.000Z")).toBe("8 Oct 2026");
  });
});

describe("formatUptime", () => {
  it("drops leading zero units", () => {
    expect(formatUptime(42)).toBe("0m");
    expect(formatUptime(3_660)).toBe("1h 1m");
    expect(formatUptime(93_784)).toBe("1d 2h 3m");
    expect(formatUptime(86_400)).toBe("1d 0h 0m");
  });
});
