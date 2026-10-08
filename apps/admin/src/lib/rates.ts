/** 1.1700000 → "1.17"; up to six significant digits. Null: no rate yet. */
export function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  const text = rate.toPrecision(6);
  return text.includes(".") && !text.includes("e") ? text.replace(/\.?0+$/, "") : text;
}

/** A rate the API accepts: a positive number. Blank goes back to the fetched rate. */
export function rateProblem(value: string): string | null {
  if (value.trim() === "") return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? null : "Enter a number above 0, or leave it blank.";
}
