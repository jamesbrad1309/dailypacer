import { describe, expect, it } from "vitest";
import { balancesByMonth } from "#finance/reports.service";

describe("balancesByMonth", () => {
  const months = ["2026-08", "2026-09", "2026-10"];

  it("carries the opening balance and earlier months into the first month shown", () => {
    const result = balancesByMonth(
      [{ id: "current", openingBalanceMinor: 10_000, openingMonth: "2026-01" }],
      [
        { accountId: "current", month: "2026-03", amountMinor: -2_000 },
        { accountId: "current", month: "2026-09", amountMinor: 5_000 },
        { accountId: "current", month: "2026-10", amountMinor: -1_000 },
      ],
      months,
    );
    expect(result.get("current")).toEqual([8_000, 13_000, 12_000]);
  });

  it("has no balance for months before an account was opened", () => {
    const result = balancesByMonth(
      [{ id: "card", openingBalanceMinor: -50_000, openingMonth: "2026-09" }],
      [{ accountId: "card", month: "2026-09", amountMinor: 20_000 }],
      months,
    );
    expect(result.get("card")).toEqual([undefined, -30_000, -30_000]);
  });
});
