import { describe, expect, it } from "vitest";
import type { Transaction } from "#graphql/types";
import { csvCell, decimalAmount, transactionsToCsv } from "#lib/csv-export";

describe("csvCell", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Tesco")).toBe("Tesco");
    expect(csvCell("Tesco, Leeds")).toBe('"Tesco, Leeds"');
    expect(csvCell('the "big" shop')).toBe('"the ""big"" shop"');
  });

  it("defuses text that a spreadsheet would run as a formula", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+44 20")).toBe("'+44 20");
    expect(csvCell("@sum")).toBe("'@sum");
  });
});

describe("decimalAmount", () => {
  it("writes minor units as a plain decimal", () => {
    expect(decimalAmount(-1250, 2)).toBe("-12.50");
    expect(decimalAmount(5, 2)).toBe("0.05");
    expect(decimalAmount(-45000, 0)).toBe("-45000");
  });
});

const category = (name: string) => ({
  id: name,
  name,
  icon: null,
  kind: "expense",
  aliases: [],
  key: null,
  color: null,
  parentId: null,
  archivedAt: null,
  sortOrder: 0,
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: "t1",
  date: "2026-10-03",
  amountMinor: -5200,
  payee: "Big shop",
  note: null,
  tags: [],
  source: "form",
  status: "CLEARED",
  isTransfer: false,
  transferAccount: null,
  createdAt: "2026-10-03T10:00:00Z",
  account: { id: "a", name: "Current", currency: "GBP" },
  category: category("Groceries"),
  splits: [],
  ...over,
});

const headings = {
  date: "Date",
  account: "Account",
  payee: "Payee",
  category: "Category",
  amount: "Amount",
  currency: "Currency",
  note: "Note",
  tags: "Tags",
  status: "Status",
};

describe("transactionsToCsv", () => {
  it("writes one row per transaction, and one per part of a split", () => {
    const csv = transactionsToCsv(
      [
        tx({}),
        tx({
          category: null,
          splits: [
            { id: "s1", amountMinor: -4000, note: null, category: category("Groceries") },
            { id: "s2", amountMinor: -1200, note: "bin bags", category: category("Home") },
          ],
        }),
      ],
      headings,
      (c) => c?.name ?? "To review",
      () => 2,
    );
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines).toEqual([
      "Date,Account,Payee,Category,Amount,Currency,Note,Tags,Status",
      "2026-10-03,Current,Big shop,Groceries,-52.00,GBP,,,CLEARED",
      "2026-10-03,Current,Big shop,Groceries,-40.00,GBP,,,CLEARED",
      "2026-10-03,Current,Big shop,Home,-12.00,GBP,bin bags,,CLEARED",
    ]);
  });
});
