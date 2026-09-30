import type { TFunction } from "i18next";
import type { BillingInterval } from "#graphql/types";
import { formatMoney } from "#lib/money";

/** "£10.99 / month", or "£29.97 every 3 months". */
export function cadenceText(
  t: TFunction,
  amountMinor: number,
  currency: string,
  interval: BillingInterval,
  intervalCount: number,
): string {
  const amount = formatMoney(amountMinor, currency);
  return intervalCount === 1
    ? t(`finance.subscriptions.per.${interval}`, { amount })
    : t(`finance.subscriptions.every.${interval}`, { amount, count: intervalCount });
}
