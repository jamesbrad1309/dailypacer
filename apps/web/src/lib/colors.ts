/**
 * Colours to pick from for habits and categories: mid-tone, so a dot of
 * one reads on both the light and the dark theme. Stored as the hex value;
 * `key` names it for screen readers (`common.colors.<key>`).
 */
export const SWATCH_COLORS = [
  { key: "red", hex: "#e5484d" },
  { key: "orange", hex: "#f76b15" },
  { key: "amber", hex: "#d6a10b" },
  { key: "green", hex: "#30a46c" },
  { key: "teal", hex: "#12a594" },
  { key: "blue", hex: "#3e63dd" },
  { key: "purple", hex: "#8e4ec6" },
  { key: "pink", hex: "#d6409f" },
  { key: "gray", hex: "#8b8d98" },
] as const;

/** `#rrggbb` at an alpha of 0–1, as `#rrggbbaa`; other strings come back unchanged. */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `${hex}${byte.toString(16).padStart(2, "0")}`;
}
