/**
 * Formatting for the admin tables. English only for now: the admin isn't
 * translated (docs/admin/use-cases.md).
 */

const LOCALE = "en-GB";

/** 123433, "GBP" → "£1,234.33". Amounts are integer minor units, like everywhere else. */
export function formatMoney(minor: number, currency: string): string {
  const fmt = new Intl.NumberFormat(LOCALE, { style: "currency", currency });
  const digits = fmt.resolvedOptions().maximumFractionDigits ?? 2;
  return fmt.format(minor / 10 ** digits);
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat(LOCALE).format(n);
}

/** An ISO timestamp or YYYY-MM-DD → "8 Oct 2026". */
export function formatDate(iso: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return date.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
}

/** 93784 → "1d 2h 3m"; under a minute → "0m". */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const parts = [days && `${days}d`, (days || hours) && `${hours}h`, `${minutes}m`];
  return parts.filter(Boolean).join(" ");
}
