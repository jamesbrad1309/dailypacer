import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { HabitHistorySkeleton } from "#components/layout/Skeletons";
import { HABIT_PAGE_FETCH, HABITS_QUERY } from "#graphql/habits";
import type { HabitsData, HeatmapDay } from "#graphql/types";
import { formatShortDate, formatWeekday, fromIsoDate } from "#lib/dates";
import { cn } from "#lib/utils";

/** How many days the grid shows, ending today. */
export const HISTORY_DAYS = 30;

function cellClass(day: HeatmapDay): string {
  if (day.completed) return "bg-emerald-500";
  if (day.value != null) return "bg-emerald-300 dark:bg-emerald-800";
  return "bg-muted";
}

/**
 * One row per habit, one column per day for the last 30 days: a green cell
 * means the habit was done that day. Reads the tail of each habit's 120-day
 * `heatmap` (oldest first, ending today), so it needs no query of its own.
 */
export function HabitHistory() {
  const { t } = useTranslation();
  const { data, loading, error } = useQuery<HabitsData>(HABITS_QUERY, HABIT_PAGE_FETCH);

  if (loading && !data) return <HabitHistorySkeleton />;
  if (error) return <p className="text-destructive">{error.message}</p>;
  if (!data?.habits.length) {
    return <p className="text-muted-foreground">{t("habits.none")}</p>;
  }

  const rows = data.habits.map((habit) => {
    const days = habit.heatmap.slice(-HISTORY_DAYS);
    return { habit, days, done: days.filter((d) => d.completed).length };
  });
  const dates = rows[0].days.map((d) => d.date);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[44rem] border-separate border-spacing-1 p-3 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-px bg-card" />
              {dates.map((date) => {
                const d = fromIsoDate(date);
                return (
                  <th
                    key={date}
                    scope="col"
                    title={formatShortDate(date)}
                    className={cn(
                      "text-center text-[11px] leading-tight font-normal text-muted-foreground tabular-nums",
                      (d.getDay() === 0 || d.getDay() === 6) && "text-foreground/70",
                    )}
                  >
                    <span className="block">{formatWeekday(d).slice(0, 2)}</span>
                    <span className="block">{d.getDate()}</span>
                  </th>
                );
              })}
              <th
                scope="col"
                className="w-px pl-3 text-right text-xs font-medium whitespace-nowrap text-muted-foreground"
              >
                {t("habits.history.frequency")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ habit, days, done }) => (
              <tr key={habit.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-48 truncate bg-card pr-4 text-left font-medium whitespace-nowrap"
                  title={habit.name}
                >
                  <Link
                    to="/habits/$habitId"
                    params={{ habitId: habit.id }}
                    className="hover:underline"
                  >
                    {habit.icon && <span className="mr-1.5">{habit.icon}</span>}
                    {habit.name}
                  </Link>
                </th>
                {days.map((day) => (
                  <td key={day.date} className="p-0">
                    <div
                      title={
                        day.completed
                          ? t("habits.card.doneOn", { date: formatShortDate(day.date) })
                          : formatShortDate(day.date)
                      }
                      className={cn(
                        "mx-auto aspect-square w-full max-w-10 rounded-[4px]",
                        cellClass(day),
                      )}
                    />
                    <span className="sr-only">
                      {formatShortDate(day.date)}:{" "}
                      {day.completed ? t("habits.history.done") : t("habits.history.notDone")}
                    </span>
                  </td>
                ))}
                <td className="pl-3 text-right whitespace-nowrap tabular-nums">
                  <span className="font-semibold">{done}</span>
                  <span className="text-muted-foreground">/{days.length}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {Math.round((done / Math.max(days.length, 1)) * 100)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <Legend className="bg-emerald-500" label={t("habits.history.done")} />
        <Legend
          className="bg-emerald-300 dark:bg-emerald-800"
          label={t("habits.history.partial")}
        />
        <Legend className="bg-muted" label={t("habits.history.notDone")} />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-[2px]", className)} />
      {label}
    </span>
  );
}
