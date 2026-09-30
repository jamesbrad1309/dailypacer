import type { BillingInterval } from "@prisma/client";
import { dayInMonth, fromIsoDate, toIsoDate } from "#finance/calendar.util";

/**
 * Subscription billing dates, as pure functions over "YYYY-MM-DD" strings.
 * Nothing is stored ahead of time: every charge date is the anchor
 * (`firstChargeOn`) plus a whole number of intervals.
 */

export interface Schedule {
  interval: BillingInterval;
  intervalCount: number;
  /** YYYY-MM-DD */
  firstChargeOn: string;
  /** YYYY-MM-DD, exclusive: no charges on or after it. */
  endsOn: string | null;
}

export interface Price {
  amountMinor: number;
  /** YYYY-MM-DD */
  effectiveFrom: string;
}

/** Enough for a weekly subscription over 20 years; guards against a runaway walk. */
const MAX_STEPS = 1100;

/**
 * The `n`th charge date (n = 0 is the anchor). Months and years count from
 * the anchor's day, not the previous charge, so a charge on the 31st falls
 * on 28 Feb and is back on the 31st in March.
 */
export function nthCharge(schedule: Schedule, n: number): string {
  const anchor = fromIsoDate(schedule.firstChargeOn);
  const step = n * schedule.intervalCount;
  if (schedule.interval === "WEEK") {
    return toIsoDate(new Date(anchor.getTime() + step * 7 * 86_400_000));
  }
  const months = schedule.interval === "MONTH" ? step : step * 12;
  return toIsoDate(
    dayInMonth(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, anchor.getUTCDate()),
  );
}

/** Rough number of intervals between the anchor and `date`, never over the real count. */
function stepsBefore(schedule: Schedule, date: string): number {
  const days =
    (fromIsoDate(date).getTime() - fromIsoDate(schedule.firstChargeOn).getTime()) / 86_400_000;
  const perStep = schedule.interval === "WEEK" ? 7 : schedule.interval === "MONTH" ? 31 : 366;
  return Math.max(0, Math.floor(days / (perStep * schedule.intervalCount)));
}

/** Charge dates from `from` to `to`, both inclusive, oldest first. */
export function chargesBetween(schedule: Schedule, from: string, to: string): string[] {
  const dates: string[] = [];
  const last = schedule.endsOn && schedule.endsOn <= to ? previousDay(schedule.endsOn) : to;
  for (let n = stepsBefore(schedule, from), i = 0; i < MAX_STEPS; n++, i++) {
    const date = nthCharge(schedule, n);
    if (date > last) break;
    if (date >= from) dates.push(date);
  }
  return dates;
}

/** The first charge on or after `date`, or null once it has ended. */
export function nextCharge(schedule: Schedule, date: string): string | null {
  for (let n = stepsBefore(schedule, date), i = 0; i < MAX_STEPS; n++, i++) {
    const next = nthCharge(schedule, n);
    if (schedule.endsOn && next >= schedule.endsOn) return null;
    if (next >= date) return next;
  }
  return null;
}

export function isChargeDate(schedule: Schedule, date: string): boolean {
  return chargesBetween(schedule, date, date).length === 1;
}

/** The price in effect on `date`; before the first recorded price, the first one. */
export function priceOn(prices: readonly Price[], date: string): number {
  if (prices.length === 0) throw new Error("A subscription always has a price");
  const sorted = [...prices].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  let amount = sorted[0].amountMinor;
  for (const price of sorted) {
    if (price.effectiveFrom <= date) amount = price.amountMinor;
  }
  return amount;
}

/** What one charge costs per year: £9.99 monthly → £119.88. */
export function yearlyCost(
  amountMinor: number,
  interval: BillingInterval,
  intervalCount: number,
): number {
  const perYear = { WEEK: 52, MONTH: 12, YEAR: 1 }[interval] / intervalCount;
  return Math.round(amountMinor * perYear);
}

/** The same cost spread over a month: £120 a year → £10. */
export function monthlyCost(
  amountMinor: number,
  interval: BillingInterval,
  intervalCount: number,
): number {
  return Math.round(yearlyCost(amountMinor, interval, intervalCount) / 12);
}

export function previousDay(iso: string): string {
  return toIsoDate(new Date(fromIsoDate(iso).getTime() - 86_400_000));
}
