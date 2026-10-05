import { useQuery } from "@apollo/client/react";
import { Check, CircleDashed, Minus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ListSkeleton } from "#components/layout/Skeletons";
import { Button } from "#components/ui/button";
import { HABIT_RECORDS_QUERY } from "#graphql/habits";
import type { Habit, HabitRecordFilter, HabitRecordStatus, HabitRecordsData } from "#graphql/types";
import { formatLongDate, formatShortDate, fromIsoDate, todayIsoDate } from "#lib/dates";
import { cn } from "#lib/utils";

export const RECORDS_PAGE_SIZE = 25;

const FILTERS: {
  value: HabitRecordFilter;
  label: `habits.detail.filter${"All" | "Done" | "NotDone" | "Missed"}`;
}[] = [
  { value: "ALL", label: "habits.detail.filterAll" },
  { value: "DONE", label: "habits.detail.filterDone" },
  { value: "NOT_DONE", label: "habits.detail.filterNotDone" },
  { value: "MISSED", label: "habits.detail.filterMissed" },
];

type StatusLabel =
  `habits.detail.status${"Done" | "Partial" | "NotDone" | "Missed" | "MissedWeek" | "Slipped"}`;

const MISSED_STYLE = "border border-dashed border-muted-foreground/40 text-muted-foreground";

const STATUS: Record<
  HabitRecordStatus,
  { icon: typeof Check; className: string; label: StatusLabel }
> = {
  DONE: {
    icon: Check,
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    label: "habits.detail.statusDone",
  },
  PARTIAL: {
    icon: Minus,
    className: "bg-emerald-500/10 text-emerald-700/80 dark:text-emerald-300/80",
    label: "habits.detail.statusPartial",
  },
  NOT_DONE: {
    icon: Minus,
    className: "bg-muted text-muted-foreground",
    label: "habits.detail.statusNotDone",
  },
  MISSED: { icon: CircleDashed, className: MISSED_STYLE, label: "habits.detail.statusMissed" },
  SLIPPED: {
    icon: X,
    className: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
    label: "habits.detail.statusSlipped",
  },
  MISSED_WEEK: {
    icon: CircleDashed,
    className: MISSED_STYLE,
    label: "habits.detail.statusMissedWeek",
  },
};

/**
 * A habit's check-ins and misses, a page at a time from the server
 * (`habitRecords`): the browser never holds more than one page. The
 * previous page stays on screen, dimmed, while the next one loads.
 */
export function HabitRecordsTable({ habit }: { habit: Habit }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<HabitRecordFilter>("ALL");
  const [page, setPage] = useState(1);
  const { data, previousData, loading, error } = useQuery<HabitRecordsData>(HABIT_RECORDS_QUERY, {
    variables: {
      habitId: habit.id,
      today: todayIsoDate(),
      filter,
      page,
      pageSize: RECORDS_PAGE_SIZE,
    },
  });
  const records = (data ?? previousData)?.habitRecords;
  const pages = records ? Math.max(1, Math.ceil(records.total / RECORDS_PAGE_SIZE)) : 1;
  const unit = habit.unit ?? "";

  function changeFilter(next: HabitRecordFilter) {
    setFilter(next);
    setPage(1);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">
          {t("habits.detail.records")}
          {records && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {t("habits.detail.summary", {
                count: records.counts.done + records.counts.notDone,
              })}
              {records.counts.missed > 0 && (
                <>
                  {" · "}
                  {t(
                    records.missesByWeek ? "habits.detail.missedWeeks" : "habits.detail.missedDays",
                    { count: records.counts.missed },
                  )}
                </>
              )}
            </span>
          )}
        </h3>
        <fieldset className="flex rounded-md border p-0.5">
          <legend className="sr-only">{t("habits.detail.colStatus")}</legend>
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => changeFilter(value)}
              className={cn(
                "rounded px-3 py-1 text-xs transition-colors",
                filter === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(label)}
              {value === "MISSED" && records && (
                <span className="ml-1 tabular-nums opacity-70">({records.counts.missed})</span>
              )}
            </button>
          ))}
        </fieldset>
      </div>
      <p className="text-xs text-muted-foreground">
        {habit.schedule.type === "timesPerWeek"
          ? t("habits.detail.missedHintWeek", { count: habit.schedule.count })
          : t("habits.detail.missedHintDay")}
      </p>

      {error && <p className="text-destructive">{error.message}</p>}

      {!records ? (
        <ListSkeleton rows={5} />
      ) : records.counts.all === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("habits.detail.none")}
        </p>
      ) : records.items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("habits.detail.noneFiltered")}
        </p>
      ) : (
        <div
          aria-busy={loading}
          className={cn(
            "overflow-x-auto rounded-xl border bg-card transition-opacity",
            loading && "opacity-60",
          )}
        >
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  {t("habits.detail.colDate")}
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  {t("habits.detail.colStatus")}
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  {t("habits.detail.colValue")}
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  {t("habits.detail.colNote")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.items.map(({ date, status, entry, week }) => {
                const { icon: Icon, className, label } = STATUS[status];
                return (
                  <tr key={`${status}-${date}`} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {week
                        ? t("habits.detail.weekOf", {
                            start: formatShortDate(week.start),
                            end: formatShortDate(week.end),
                          })
                        : formatLongDate(fromIsoDate(date))}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                          className,
                        )}
                      >
                        <Icon className="size-3" />
                        {t(label)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                      {week ? (
                        <>
                          {week.done}
                          <span className="text-muted-foreground"> / {week.target}</span>
                        </>
                      ) : entry?.value != null ? (
                        <>
                          {entry.value}
                          {habit.targetValue != null && (
                            <span className="text-muted-foreground"> / {habit.targetValue}</span>
                          )}
                          {unit && <span className="text-muted-foreground"> {unit}</span>}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="max-w-80 px-4 py-2.5 text-muted-foreground">
                      {entry?.note || ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage(page - 1)}
          >
            {t("habits.detail.previous")}
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {t("habits.detail.page", { page, pages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages || loading}
            onClick={() => setPage(page + 1)}
          >
            {t("habits.detail.next")}
          </Button>
        </div>
      )}
    </section>
  );
}
