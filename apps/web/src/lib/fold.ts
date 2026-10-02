/** Case, accents and spacing don't matter: "Lo Âu", "lo au" and " lo âu " fold to one key. */
export function fold(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/đ/g, "d").trim();
}
