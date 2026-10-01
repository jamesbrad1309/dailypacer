import type { TFunction } from "i18next";
import type { BillingInterval } from "#graphql/types";
import { formatMoney } from "#lib/money";

/** A charge's amount; money in (a salary) gets a "+". */
export function chargeAmount(amountMinor: number, currency: string, isIncome: boolean): string {
  return `${isIncome ? "+" : ""}${formatMoney(amountMinor, currency)}`;
}

/** "£10.99 / month", "£29.97 every 3 months", or "+£2,500.00 / month" for money in. */
export function cadenceText(
  t: TFunction,
  amountMinor: number,
  currency: string,
  interval: BillingInterval,
  intervalCount: number,
  isIncome = false,
): string {
  const amount = chargeAmount(amountMinor, currency, isIncome);
  return intervalCount === 1
    ? t(`finance.subscriptions.per.${interval}`, { amount })
    : t(`finance.subscriptions.every.${interval}`, { amount, count: intervalCount });
}
