import type { Transaction } from "#graphql/types";

/** Column headings, in the user's language. */
export interface CsvHeadings {
  date: string;
  account: string;
  payee: string;
  category: string;
  amount: string;
  currency: string;
  note: string;
  tags: string;
  status: string;
}

/**
 * A spreadsheet cell: quoted when it holds a comma, quote or line break,
 * and with a leading ' when text starts like a formula (=, +, -, @), so a
 * payee like "=HYPERLINK(…)" can't run when the file is opened.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Minor units as a plain decimal ("-12.50"), never locale-formatted, so spreadsheets read it as a number. */
export function decimalAmount(minor: number, digits: number): string {
  if (digits === 0) return String(minor);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const unit = 10 ** digits;
  return `${sign}${Math.floor(abs / unit)}.${String(abs % unit).padStart(digits, "0")}`;
}

/**
 * Transactions as CSV text, one row each. A split transaction is one row
 * per part, so each category's total adds up in a pivot table; amounts
 * stay numeric (not formula-escaped).
 */
export function transactionsToCsv(
  transactions: Transaction[],
  headings: CsvHeadings,
  categoryLabel: (category: Transaction["category"]) => string,
  digitsFor: (currency: string) => number,
): string {
  const header = [
    headings.date,
    headings.account,
    headings.payee,
    headings.category,
    headings.amount,
    headings.currency,
    headings.note,
    headings.tags,
    headings.status,
  ].map(csvCell);
  const rows = transactions.flatMap((tx) => {
    const parts = tx.splits.length
      ? tx.splits.map((s) => ({
          category: s.category,
          amountMinor: s.amountMinor,
          note: s.note ?? tx.note,
        }))
      : [{ category: tx.category, amountMinor: tx.amountMinor, note: tx.note }];
    return parts.map((part) =>
      [
        csvCell(tx.date),
        csvCell(tx.account.name),
        csvCell(tx.payee ?? ""),
        csvCell(tx.isTransfer ? "" : categoryLabel(part.category)),
        decimalAmount(part.amountMinor, digitsFor(tx.account.currency)),
        csvCell(tx.account.currency),
        csvCell(part.note ?? ""),
        csvCell(tx.tags.join(" ")),
        csvCell(tx.status),
      ].join(","),
    );
  });
  // CRLF and a BOM: what Excel expects to open UTF-8 (đ, £) correctly.
  return `﻿${[header.join(","), ...rows].join("\r\n")}\r\n`;
}
