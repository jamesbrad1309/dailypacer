import { useQuery } from "@apollo/client/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MONEY_IN_CLASS } from "#components/finance/Amount";
import { ServiceLogo } from "#components/finance/subscriptions/ServiceLogo";
import { Button } from "#components/ui/button";
import { Card } from "#components/ui/card";
import { SUBSCRIPTION_CHARGES_QUERY } from "#graphql/subscriptions";
import type { ChargeStatus, SubscriptionCharge } from "#graphql/types";
import { useCurrencies } from "#hooks/useCurrencies";
import { chargeAmount } from "#lib/cadence";
import {
  addDays,
  addMonths,
  formatDayHeading,
  formatMonth,
  formatWeekday,
  fromIsoDate,
  monthRange,
  startOfWeek,
  todayIsoDate,
} from "#lib/dates";
import { formatMoney } from "#lib/money";
import { cn } from "#lib/utils";

/** Logos shown in a day cell before "+N". */
const MAX_LOGOS = 3;

const STATUS_CLASS: Record<ChargeStatus, string> = {
  PENDING: "ring-2 ring-amber-500",
  CONFIRMED: "",
  SKIPPED: "opacity-40 grayscale",
  UPCOMING: "",
};

interface Props {
  month: string;
  onMonthChange: (month: string) => void;
}

/**
 * A month of charges on a calendar: each day shows the logos of what's
 * charged that day, and choosing a day lists them with amounts below. A
 * real table, so screen readers get rows (weeks) and columns (weekdays).
 */
export function ChargeCalendar({ month, onMonthChange }: Props) {
  const { t } = useTranslation();
  const { main, toMain } = useCurrencies();
  const today = todayIsoDate();
  const { from, to } = monthRange(month);
  const { data } = useQuery<{ subscriptionCharges: SubscriptionCharge[] }>(
    SUBSCRIPTION_CHARGES_QUERY,
    { variables: { from, to, today } },
  );
  const charges = data?.subscriptionCharges ?? [];
  const byDay = new Map<string, SubscriptionCharge[]>();
  for (const charge of charges) {
    byDay.set(charge.dueOn, [...(byDay.get(charge.dueOn) ?? []), charge]);
  }

  const [picked, setPicked] = useState<string | null>(null);
  const selected =
    picked && picked >= from && picked <= to
      ? picked
      : today >= from && today <= to
        ? today
        : (charges[0]?.dueOn ?? from);

  /** Adds up costs in the main currency; money in and charges without a rate are left out. */
  const total = (list: SubscriptionCharge[]) =>
    list
      .filter((c) => c.status !== "SKIPPED" && !c.subscription.isIncome)
      .reduce((sum, c) => sum + (toMain(c.amountMinor, c.currency) ?? 0), 0);

  // Whole weeks, Monday first, covering the month.
  const weeks: string[][] = [];
  for (let day = startOfWeek(from); day <= to; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)));
  }
  const selectedCharges = byDay.get(selected) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.previousMonth")}
          onClick={() => onMonthChange(addMonths(month, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="w-32 text-center text-sm font-medium" aria-live="polite">
          {formatMonth(month)}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.nextMonth")}
          onClick={() => onMonthChange(addMonths(month, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        <p className="ml-auto text-sm text-muted-foreground tabular-nums">
          {charges.length
            ? t("finance.subscriptions.calendar.monthTotal", {
                amount: formatMoney(total(charges), main),
                month: formatMonth(month),
              })
            : t("finance.subscriptions.calendar.none")}
        </p>
      </div>

      <Card className="overflow-hidden p-1 sm:p-2">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">{formatMonth(month)}</caption>
          <thead>
            <tr>
              {weeks[0].map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="pb-1 text-center text-xs font-medium text-muted-foreground"
                >
                  <abbr title={formatWeekday(fromIsoDate(day), "long")} className="no-underline">
                    {formatWeekday(fromIsoDate(day))}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]}>
                {week.map((day) => {
                  const inMonth = day >= from && day <= to;
                  const list = byDay.get(day) ?? [];
                  return (
                    <td key={day} className="p-0.5 align-top">
                      {inMonth && (
                        <button
                          type="button"
                          aria-pressed={day === selected}
                          onClick={() => setPicked(day)}
                          className={cn(
                            "flex h-16 w-full flex-col items-start gap-1 rounded-md p-1 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring sm:h-20",
                            day === selected && "bg-accent",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-5 items-center justify-center rounded-full text-xs tabular-nums",
                              day === today && "bg-foreground font-semibold text-background",
                            )}
                          >
                            {Number(day.slice(8))}
                          </span>
                          {list.length > 0 && (
                            <span className="flex flex-wrap gap-0.5" aria-hidden>
                              {list.slice(0, MAX_LOGOS).map((c) => (
                                <ServiceLogo
                                  key={c.id}
                                  name={c.subscription.name}
                                  logoUrl={c.subscription.logoUrl}
                                  size="sm"
                                  className={STATUS_CLASS[c.status]}
                                />
                              ))}
                              {list.length > MAX_LOGOS && (
                                <span className="text-[0.65rem] text-muted-foreground">
                                  +{list.length - MAX_LOGOS}
                                </span>
                              )}
                            </span>
                          )}
                          <span className="sr-only">
                            {formatDayHeading(day)}
                            {list.length > 0 &&
                              `, ${t("finance.subscriptions.calendar.dayCharges", {
                                count: list.length,
                                amount: formatMoney(total(list), main),
                              })}`}
                          </span>
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <section aria-live="polite">
        <h3 className="mb-2 text-sm font-medium">{formatDayHeading(selected)}</h3>
        {selectedCharges.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {selectedCharges.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <ServiceLogo name={c.subscription.name} logoUrl={c.subscription.logoUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.subscription.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {c.subscription.account.name} ·{" "}
                    {c.transactionPending
                      ? t("finance.subscriptions.calendar.loggedPending")
                      : t(`finance.subscriptions.calendar.chargeStatus.${c.status}`)}
                    {c.afterTrial && ` · ${t("finance.subscriptions.afterTrial")}`}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    c.subscription.isIncome && MONEY_IN_CLASS,
                    c.status === "SKIPPED" && "text-muted-foreground line-through",
                  )}
                >
                  {chargeAmount(c.amountMinor, c.currency, c.subscription.isIncome)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
