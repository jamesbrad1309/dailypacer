import { useQuery } from "@apollo/client/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "#components/ui/skeleton";
import { HABIT_INSIGHTS_QUERY } from "#graphql/habits";
import type { HabitInsightsData } from "#graphql/types";
import { formatMonthName, formatWeekday, fromIsoDate, todayIsoDate } from "#lib/dates";
import { cn } from "#lib/utils";

const BAR_HEIGHT = 120;
const MIN_DAYS_TO_COMPARE = 5;
/** 2026-01-05 was a Monday: weekday index i is 2026-01-(05+i). */
const weekdayDate = (index: number) => fromIsoDate(`2026-01-${String(5 + index).padStart(2, "0")}`);
const percent = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)}%`);

/**
 * Two cards for a habit's detail page, worked out on the server with the
 * same schedule and pause rules as its misses: completion rate by weekday
 * (best and worst named, not just coloured) and this month vs last month.
 */
export function HabitInsights({ habitId }: { habitId: string }) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const { data, error } = useQuery<HabitInsightsData>(HABIT_INSIGHTS_QUERY, {
    variables: { habitId, today },
  });
  const [hovered, setHovered] = useState<number | null>(null);

  if (error) return <p className="text-destructive">{error.message}</p>;
  if (!data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  const { weekdays, best, worst, thisMonth, lastMonth } = data.habitInsights;
  const hoveredStat = hovered === null ? null : weekdays[hovered];
  // A rate from a day or two isn't a trend: compare once this month has a few days in it.
  const tooEarly = thisMonth.due < MIN_DAYS_TO_COMPARE;
  const delta =
    !tooEarly && thisMonth.rate !== null && lastMonth.rate !== null
      ? Math.round((thisMonth.rate - lastMonth.rate) * 100)
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs text-muted-foreground">{t("habits.insights.weekdayTitle")}</h3>
          <p className="h-4 text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {hoveredStat &&
              t("habits.insights.weekdayTooltip", {
                day: formatWeekday(weekdayDate(hoveredStat.weekday), "long"),
                done: hoveredStat.done,
                due: hoveredStat.due,
                rate: percent(hoveredStat.rate),
              })}
          </p>
        </div>

        <div className="flex items-end gap-2" style={{ height: BAR_HEIGHT + 20 }}>
          {weekdays.map((stat) => (
            <div
              key={stat.weekday}
              role="img"
              aria-label={t("habits.insights.weekdayTooltip", {
                day: formatWeekday(weekdayDate(stat.weekday), "long"),
                done: stat.done,
                due: stat.due,
                rate: percent(stat.rate),
              })}
              onMouseEnter={() => setHovered(stat.weekday)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "flex h-full flex-1 flex-col items-center justify-end gap-1 rounded-md",
                hovered === stat.weekday && "bg-accent/50",
              )}
            >
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {percent(stat.rate)}
              </span>
              <span
                className={cn(
                  "w-full max-w-10 rounded-t-[4px]",
                  stat.rate === null ? "bg-transparent" : "bg-emerald-600 dark:bg-emerald-500",
                )}
                style={{ height: Math.max(stat.rate ? 2 : 0, (stat.rate ?? 0) * BAR_HEIGHT) }}
              />
            </div>
          ))}
        </div>
        <div className="-mt-1 flex gap-2 border-t pt-1.5">
          {weekdays.map((stat) => (
            <span key={stat.weekday} className="flex flex-1 flex-col items-center text-[10px]">
              <span
                className={cn(
                  "text-muted-foreground",
                  (stat.weekday === best || stat.weekday === worst) &&
                    "font-semibold text-foreground",
                )}
              >
                {formatWeekday(weekdayDate(stat.weekday))}
              </span>
              <span className="h-3 text-muted-foreground">
                {stat.weekday === best
                  ? t("habits.insights.best")
                  : stat.weekday === worst
                    ? t("habits.insights.worst")
                    : ""}
              </span>
            </span>
          ))}
        </div>
        <p className="text-sm">
          {best !== null && worst !== null
            ? t("habits.insights.weekdaySummary", {
                best: formatWeekday(weekdayDate(best), "long"),
                worst: formatWeekday(weekdayDate(worst), "long"),
              })
            : t("habits.insights.weekdayFlat")}
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <h3 className="text-xs text-muted-foreground">{t("habits.insights.monthTitle")}</h3>
        {[
          { key: "this", period: thisMonth, strong: true },
          { key: "last", period: lastMonth, strong: false },
        ].map(({ key, period, strong }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className={cn(!strong && "text-muted-foreground")}>
                {formatMonthName(period.from.slice(0, 7))}
                {strong && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {t("habits.insights.soFar")}
                  </span>
                )}
              </span>
              <span className="tabular-nums">
                <span className="font-semibold">{percent(period.rate)}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {t("habits.insights.doneOf", { done: period.done, due: period.due })}
                </span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  strong ? "bg-emerald-600 dark:bg-emerald-500" : "bg-muted-foreground/50",
                )}
                style={{ width: `${Math.round((period.rate ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        <p className="mt-auto text-sm">
          {delta === null ? (
            <span className="text-muted-foreground">
              {tooEarly ? t("habits.insights.monthTooEarly") : t("habits.insights.monthNoData")}
            </span>
          ) : (
            <>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  delta > 0 && "text-emerald-700 dark:text-emerald-400",
                )}
              >
                {delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "±0"}
              </span>{" "}
              {t("habits.insights.points", { count: Math.abs(delta) })}{" "}
              {t("habits.insights.vsLastMonth")}
            </>
          )}
        </p>
      </section>
    </div>
  );
}
