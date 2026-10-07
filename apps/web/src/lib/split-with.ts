import { parseMoneyInput } from "#lib/money";

/**
 * "Split with…" in quick log: who else is on the bill, and how it's
 * shared. The API checks the same rules (apps/api/src/finance/split-with.util.ts).
 */
export interface SplitDraft {
  /** IOU account ids, in the order they were picked. */
  people: string[];
  /** Typed amounts per person; when false, everyone (you too) pays the same. */
  custom: boolean;
  amounts: Record<string, string>;
}

export const EMPTY_SPLIT: SplitDraft = { people: [], custom: false, amounts: {} };

export interface SplitResult {
  shares: { accountId: string; amountMinor: number }[];
  /** Your share: the bill less everyone else's. */
  mineMinor: number;
  /** Why it can't be saved yet: a translation key under finance.splitWith. */
  problem: "noPeople" | "enterShares" | "tooMuch" | null;
}

/** The shares for a bill of `totalMinor`: even (you take the leftover pennies) or as typed. */
export function splitShares(draft: SplitDraft, totalMinor: number, currency: string): SplitResult {
  if (draft.people.length === 0) return { shares: [], mineMinor: totalMinor, problem: "noPeople" };
  const shares = draft.people.map((accountId) => ({
    accountId,
    amountMinor: draft.custom
      ? (parseMoneyInput(draft.amounts[accountId] ?? "", currency) ?? 0)
      : Math.floor(totalMinor / (draft.people.length + 1)),
  }));
  const mineMinor = totalMinor - shares.reduce((sum, s) => sum + s.amountMinor, 0);
  const problem = shares.some((s) => s.amountMinor <= 0)
    ? "enterShares"
    : mineMinor <= 0
      ? "tooMuch"
      : null;
  return { shares, mineMinor, problem };
}
