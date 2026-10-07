/**
 * "Split with…" (docs/finance/quick-log.md): an expense paid for several
 * people becomes your share as spending, plus each other person's share
 * moved to their IOU account, so they owe you that much more.
 */

/** At most this many people on one bill. */
export const MAX_SHARES = 10;

export interface Share {
  /** The person's IOU account. */
  accountId: string;
  /** Positive: what they owe you for it. */
  amountMinor: number;
}

/**
 * Why `shares` can't split a bill of `totalMinor` (positive), or null when
 * they can: one share per person, each positive, leaving you a share of
 * your own (paying entirely for someone is a transfer, not a split).
 */
export function shareProblem(totalMinor: number, shares: readonly Share[]): string | null {
  if (shares.length === 0) return "Split with at least one person";
  if (shares.length > MAX_SHARES) return `A bill splits between at most ${MAX_SHARES} people`;
  if (new Set(shares.map((s) => s.accountId)).size !== shares.length) {
    return "Each person can only have one share";
  }
  if (shares.some((s) => !Number.isInteger(s.amountMinor) || s.amountMinor <= 0)) {
    return "Every share must be more than zero";
  }
  const others = shares.reduce((sum, s) => sum + s.amountMinor, 0);
  if (others >= totalMinor) {
    return "Others' shares must leave you a share: to pay for someone outright, record a transfer to them";
  }
  return null;
}

/** Your share: the bill less everyone else's. */
export function myShare(totalMinor: number, shares: readonly Share[]): number {
  return totalMinor - shares.reduce((sum, s) => sum + s.amountMinor, 0);
}

/**
 * An even split between you and `people` others: each of them gets the
 * rounded-down share and you take the leftover pennies, so it adds up.
 */
export function equalShares(totalMinor: number, people: number): { each: number; mine: number } {
  const each = Math.floor(totalMinor / (people + 1));
  return { each, mine: totalMinor - each * people };
}
