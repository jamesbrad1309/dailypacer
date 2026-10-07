import { useQuery } from "@apollo/client/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MONEY_IN_CLASS } from "#components/finance/Amount";
import { UnconvertedNote } from "#components/finance/reports/UnconvertedNote";
import { ChargeCalendar } from "#components/finance/subscriptions/ChargeCalendar";
import { PendingCharges } from "#components/finance/subscriptions/PendingCharges";
import { ServiceLogo } from "#components/finance/subscriptions/ServiceLogo";
import { SubscriptionDialog } from "#components/finance/subscriptions/SubscriptionDialog";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { Card } from "#components/ui/card";
import {
  SUBSCRIPTION_CHARGES_QUERY,
  SUBSCRIPTION_SUMMARY_QUERY,
  SUBSCRIPTIONS_QUERY,
} from "#graphql/subscriptions";
import type { Subscription, SubscriptionCharge, SubscriptionSummary } from "#graphql/types";
import { cadenceText, chargeAmount } from "#lib/cadence";
import { addDays, currentMonth, formatDayHeading, formatShortDate, todayIsoDate } from "#lib/dates";
import { formatMoney } from "#lib/money";
import { cn } from "#lib/utils";

export type SubscriptionsTab = "upcoming" | "calendar" | "all";

/** How far ahead the Upcoming tab looks. */
export const UPCOMING_DAYS = 60;

interface Props {
  tab: SubscriptionsTab;
  month?: string;
  onChange: (next: { tab?: SubscriptionsTab; month?: string }) => void;
}

/**
 * Subscriptions: what they cost a month and a year, charges waiting to be
 * confirmed, then what's coming (a list or a calendar) and every
 * subscription, each opening its editor.
 */
export function SubscriptionsView({ tab, month, onChange }: Props) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const { data: summaryData } = useQuery<{ subscriptionSummary: SubscriptionSummary }>(
    SUBSCRIPTION_SUMMARY_QUERY,
    { variables: { today } },
  );
  const [includeEnded, setIncludeEnded] = useState(false);
  const { data, loading, error } = useQuery<{ subscriptions: Subscription[] }>(
    SUBSCRIPTIONS_QUERY,
    { variables: { today, includeEnded } },
  );
  const subscriptions = data?.subscriptions ?? [];

  // Kept after closing, so the dialog's closing animation still has content.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | undefined>();
  const openDialog = (sub?: Subscription) => {
    setEditing(sub);
    setDialogOpen(true);
  };
  // Show the latest copy after an edit refetches the list.
  const current = editing && subscriptions.find((s) => s.id === editing.id);

  const summary = summaryData?.subscriptionSummary;
  const empty = !loading && !includeEnded && subscriptions.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {summary && !empty ? (
          <Summary summary={summary} />
        ) : (
          <p className="max-w-md text-sm text-muted-foreground">
            {empty ? t("finance.subscriptions.empty") : null}
          </p>
        )}
        <Button onClick={() => openDialog()}>
          <Plus className="size-4" /> {t("finance.subscriptions.add")}
        </Button>
      </div>

      <PendingCharges />

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {!empty && (
        <>
          <div className="flex rounded-lg border p-0.5 text-sm self-start" role="tablist">
            {(["upcoming", "calendar", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => onChange({ tab: value })}
                className={cn(
                  "flex h-8 items-center rounded-md px-3 font-medium",
                  tab === value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`finance.subscriptions.tabs.${value}`)}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {tab === "upcoming" && <UpcomingList />}
            {tab === "calendar" && (
              <ChargeCalendar
                month={month ?? currentMonth()}
                onMonthChange={(next) => onChange({ month: next })}
              />
            )}
            {tab === "all" && (
              <div className="flex flex-col gap-3">
                <label className="flex cursor-pointer items-center gap-2 self-end text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeEnded}
                    onChange={(e) => setIncludeEnded(e.target.checked)}
                    className="accent-primary"
                  />
                  {t("finance.subscriptions.showEnded")}
                </label>
                <Card className="overflow-hidden">
                  <ul className="divide-y">
                    {subscriptions.map((sub) => (
                      <SubscriptionRow key={sub.id} sub={sub} onOpen={() => openDialog(sub)} />
                    ))}
                  </ul>
                </Card>
              </div>
            )}
          </div>
        </>
      )}

      <SubscriptionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        subscription={current ?? editing}
      />
    </div>
  );
}

function Summary({ summary }: { summary: SubscriptionSummary }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
      <div>
        <p className="text-sm text-muted-foreground">{t("finance.subscriptions.perMonth")}</p>
        <p className="text-5xl font-semibold tracking-tight tabular-nums">
          {formatMoney(summary.monthlyMinor, summary.currency)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {t("finance.subscriptions.perYear", {
            amount: formatMoney(summary.yearlyMinor, summary.currency),
          })}{" "}
          · {t("finance.subscriptions.active", { count: summary.activeCount })}
        </p>
        <UnconvertedNote codes={summary.unconverted} />
      </div>
      <div className="pb-1.5">
        <p className="text-sm text-muted-foreground">{t("finance.subscriptions.next30Days")}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {formatMoney(summary.next30DaysMinor, summary.currency)}
        </p>
      </div>
    </div>
  );
}

/** Upcoming charges for the next 60 days, by day. Due ones are in "Charges to confirm" instead. */
function UpcomingList() {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const { data } = useQuery<{ subscriptionCharges: SubscriptionCharge[] }>(
    SUBSCRIPTION_CHARGES_QUERY,
    { variables: { from: today, to: addDays(today, UPCOMING_DAYS - 1), today } },
  );
  if (!data) return null;
  const upcoming = data.subscriptionCharges.filter((c) => c.status === "UPCOMING");
  if (upcoming.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("finance.subscriptions.noUpcoming")}</p>;
  }

  const days: { date: string; charges: SubscriptionCharge[] }[] = [];
  for (const charge of upcoming) {
    const day = days.at(-1);
    if (day?.date === charge.dueOn) day.charges.push(charge);
    else days.push({ date: charge.dueOn, charges: [charge] });
  }

  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => (
        <section key={day.date}>
          <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {formatDayHeading(day.date)}
          </h3>
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {day.charges.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                  <ServiceLogo name={c.subscription.name} logoUrl={c.subscription.logoUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {c.subscription.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.subscription.account.name}
                    </span>
                  </span>
                  {c.afterTrial && (
                    <Badge variant="outline" className="hidden sm:inline-flex">
                      {t("finance.subscriptions.afterTrial")}
                    </Badge>
                  )}
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      c.subscription.isIncome && MONEY_IN_CLASS,
                    )}
                  >
                    {chargeAmount(c.amountMinor, c.currency, c.subscription.isIncome)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}

function SubscriptionRow({ sub, onOpen }: { sub: Subscription; onOpen: () => void }) {
  const { t } = useTranslation();
  const statusDate =
    sub.status === "TRIAL" ? sub.trialEndsOn : sub.status === "PAUSED" ? null : sub.endsOn;
  const inactive = sub.status === "PAUSED" || sub.status === "ENDED";

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-accent/40 focus-visible:bg-accent/40"
      >
        <ServiceLogo
          name={sub.name}
          logoUrl={sub.logoUrl}
          className={cn(inactive && "opacity-50 grayscale")}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{sub.name}</span>
            {sub.autoLog && (
              <Badge variant="outline" className="shrink-0">
                {t("finance.subscriptions.autoLogs")}
              </Badge>
            )}
            {sub.status !== "ACTIVE" && (
              <Badge
                variant={sub.status === "TRIAL" ? "secondary" : "outline"}
                className="shrink-0"
              >
                {t(`finance.subscriptions.status.${sub.status}`, {
                  date: statusDate ? formatShortDate(statusDate) : "",
                })}
              </Badge>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {cadenceText(
              t,
              sub.amountMinor,
              sub.currency,
              sub.interval,
              sub.intervalCount,
              sub.isIncome,
            )}{" "}
            · {sub.account.name}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm tabular-nums">
            {sub.nextChargeOn
              ? t("finance.subscriptions.next", { date: formatShortDate(sub.nextChargeOn) })
              : "—"}
          </span>
          {sub.interval !== "MONTH" || sub.intervalCount !== 1 ? (
            <span className="block text-xs text-muted-foreground tabular-nums">
              {t("finance.subscriptions.aboutMonthly", {
                amount: formatMoney(sub.monthlyMinor, sub.currency),
              })}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
