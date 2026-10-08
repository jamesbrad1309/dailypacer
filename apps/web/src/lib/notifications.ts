import { getLocale } from "#i18n/locale";
import { toIsoDate } from "#lib/dates";

/** The user's day and time, so the inbox syncs against their clock (not the server's). */
export function notificationClock(now = new Date()): { today: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  return { today: toIsoDate(now), time: `${pad(now.getHours())}:${pad(now.getMinutes())}` };
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400],
  ["month", 30 * 86_400],
  ["week", 7 * 86_400],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** "now", "5 minutes ago", "yesterday", "3 weeks ago": the largest unit that fits. */
export function formatTimeAgo(iso: string, now = new Date(), locale = getLocale()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 1000));
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return format.format(-Math.floor(seconds / size), unit);
  }
  return format.format(0, "second");
}
