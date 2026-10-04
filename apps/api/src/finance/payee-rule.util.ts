/** Case, accents and spacing don't matter when comparing payees: "TESCO  Stores" = "tesco stores". */
export function foldPayee(payee: string | null): string {
  return (
    (payee ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/đ/g, "d")
      // "SAINSBURY'S" and "sainsburys" are the same shop.
      .replace(/['\u2019]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
  );
}

export interface RuleLike {
  pattern: string;
  categoryId: string;
}

/**
 * Whether a payee rule's pattern matches a payee. Both are folded first
 * (case, accents, punctuation and spacing don't matter). `*` matches
 * anything, and a pattern with one must match the whole payee: "TESCO*"
 * matches "Tesco Stores 3245" but not "Big Tesco". Without a `*` it matches
 * anywhere in the payee: "amazon" matches "AMZ Amazon.co.uk".
 */
export function payeeMatches(pattern: string, payee: string | null): boolean {
  const folded = foldPayee(payee);
  if (!folded) return false;
  if (!pattern.includes("*")) {
    const needle = foldPayee(pattern);
    return needle.length > 0 && folded.includes(needle);
  }
  const pieces = pattern.split("*").map((piece) => foldPayee(piece));
  if (pieces.every((piece) => piece === "")) return false;
  const escaped = pieces.map((piece) => piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${escaped.join(".*")}$`).test(folded);
}

/** The first rule (in the order given: sortOrder) whose pattern matches, if any. */
export function matchRule<R extends RuleLike>(rules: readonly R[], payee: string | null): R | null {
  return rules.find((rule) => payeeMatches(rule.pattern, payee)) ?? null;
}
