/** One part of a split, as sent: same sign as the transaction. */
export interface SplitPart {
  categoryId: string;
  amountMinor: number;
  note?: string | null;
}

/** At most this many parts in one split. */
export const MAX_SPLIT_PARTS = 20;

/**
 * Why `parts` can't split a transaction of `amountMinor`, or null when they
 * can: at least two parts, none zero or of the other sign (a refund line
 * on a receipt is its own transaction), adding up to the exact amount.
 */
export function splitProblem(amountMinor: number, parts: SplitPart[]): string | null {
  if (parts.length < 2) return "A split needs at least two parts";
  if (parts.length > MAX_SPLIT_PARTS) return `A split has at most ${MAX_SPLIT_PARTS} parts`;
  const sign = Math.sign(amountMinor);
  if (parts.some((p) => !Number.isInteger(p.amountMinor) || Math.sign(p.amountMinor) !== sign)) {
    return sign < 0
      ? "Every part of money out must be money out too (negative)"
      : "Every part of money in must be money in too (positive)";
  }
  const total = parts.reduce((sum, p) => sum + p.amountMinor, 0);
  if (total !== amountMinor) {
    return `The parts add up to ${total}, not the transaction's ${amountMinor}`;
  }
  return null;
}
