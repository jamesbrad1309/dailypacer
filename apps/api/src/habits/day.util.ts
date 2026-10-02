/**
 * Calendar days as "YYYY-MM-DD" strings, the same shape HabitEntry.date is
 * sent in. Arithmetic goes through UTC so no time zone can shift a day.
 */
export type Day = string;

export function toDay(date: Date): Day {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: Day, days: number): Day {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDay(date);
}

/** Monday of the week containing `day`. */
export function startOfWeek(day: Day): Day {
  const offset = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -offset);
}

/** Local-midnight Date for schedule checks, matching the web app's `fromIsoDate`. */
export function toLocalDate(day: Day): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
