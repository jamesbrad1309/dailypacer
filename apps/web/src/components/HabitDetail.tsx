import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { ArrowLeft, Check, CircleDashed, Clock, Flame, Minus, Star, Trophy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { EditHabitDialog } from "#components/EditHabitDialog";
import { HeatmapGrid } from "#components/HeatmapGrid";
import { WeekComparisonChart } from "#components/WeekComparisonChart";
import { HabitDetailSkeleton } from "#components/layout/Skeletons";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { HABIT_DETAIL_QUERY } from "#graphql/habits";
import type { HabitDetailData, HabitSchedule } from "#graphql/types";
import {
  formatLongDate,
  formatShortDate,
  formatWeekday,
  fromIsoDate,
  todayIsoDate,
} from "#lib/dates";
import {
  type RecordStatus,
  habitRecordRows,
  isMiss,
  missesByWeek,
  trackedSince,
} from "#lib/habit-records";
import { cn } from "#lib/utils";

const PAGE_SIZE = 25;

type Filter = "all" | "done" | "notDone" | "missed";

const FILTERS: {
  value: Filter;
  label: `habits.detail.filter${"All" | "Done" | "NotDone" | "Missed"}`;
}[] = [
  { value: "all", label: "habits.detail.filterAll" },
  { value: "done", label: "habits.detail.filterDone" },
  { value: "notDone", label: "habits.detail.filterNotDone" },
  { value: "missed", label: "habits.detail.filterMissed" },
];

type StatusLabel =
  `habits.detail.status${"Done" | "Partial" | "NotDone" | "Missed" | "MissedWeek"}`;

const STATUS: Record<RecordStatus, { icon: typeof Check; className: string; label: StatusLabel }> =
  {
    done: {
      icon: Check,
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      label: "habits.detail.statusDone",
    },
    partial: {
      icon: Minus,
      className: "bg-emerald-500/10 text-emerald-700/80 dark:text-emerald-300/80",
      label: "habits.detail.statusPartial",
    },
    notDone: {
      icon: Minus,
      className: "bg-muted text-muted-foreground",
      label: "habits.detail.statusNotDone",
    },
    missed: {
      icon: CircleDashed,
      className: "border border-dashed border-muted-foreground/40 text-muted-foreground",
      label: "habits.detail.statusMissed",
    },
    missedWeek: {
      icon: CircleDashed,
      className: "border border-dashed border-muted-foreground/40 text-muted-foreground",
      label: "habits.detail.statusMissedWeek",
    },
  };

/**
 * One habit: what it is, how it's going, and every check-in in a table.
 * Opened by clicking a habit's name on the dashboard (or the History grid).
 */
export function HabitDetail({ habitId }: { habitId: string }) {
  const { t } = useTranslation();
  const { data, loading, error } = useQuery<HabitDetailData>(HABIT_DETAIL_QUERY, {
    variables: { id: habitId },
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  if (loading && !data) return <HabitDetailSkeleton />;
  if (error || !data) return <p className="text-destructive">{error?.message}</p>;

  const { habit, habitEntries } = data;
  const byWeek = missesByWeek(habit.schedule);
  const allRows = habitRecordRows(habitEntries, {
    schedule: habit.schedule,
    createdAt: habit.createdAt,
    today: todayIsoDate(),
    includeMissed: true,
  });
  const missedCount = allRows.filter(isMiss).length;
  const rows = allRows.filter((row) =>
    filter === "all"
      ? true
      : filter === "done"
        ? row.status === "done"
        : filter === "missed"
          ? isMiss(row)
          : row.status === "partial" || row.status === "notDone",
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const unit = habit.unit ?? "";

  function changeFilter(next: Filter) {
    setFilter(next);
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/habits"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t("habits.detail.back")}
      </Link>

      <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-card p-6">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {habit.icon && <span className="mr-2">{habit.icon}</span>}
            {habit.name}
          </h2>
          {habit.description && (
            <p className="max-w-prose text-sm text-muted-foreground">{habit.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{describeSchedule(habit.schedule, t)}</Badge>
            {habit.startTime && (
              <Badge variant="outline" className="gap-1">
                <Clock className="size-3" />
                {habit.startTime}
              </Badge>
            )}
            {habit.paused && <Badge variant="outline">{t("habits.card.paused")}</Badge>}
            {habit.tags.map((tag) => (
              <span key={tag} className="text-xs text-sky-600 dark:text-sky-400">
                #{tag}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("habits.detail.created", {
              date: formatShortDate(trackedSince(habit.createdAt, habitEntries)),
            })}
          </p>
        </div>
        <EditHabitDialog habit={habit} />
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat
          icon={<Flame className="size-4 text-amber-500" />}
          label={t("habits.detail.currentStreak")}
          value={t("habits.detail.days", { count: habit.currentStreak })}
        />
        <Stat
          icon={<Trophy className="size-4 text-amber-500" />}
          label={t("habits.detail.bestStreak")}
          value={t("habits.detail.days", { count: habit.longestStreak })}
        />
        <Stat
          icon={<Check className="size-4 text-emerald-500" />}
          label={t("habits.detail.checkIns")}
          value={habit.totalCompletions}
        />
        <Stat
          icon={<Star className="size-4 text-violet-500" />}
          label={t("habits.detail.level")}
          value={t("habits.card.level", { level: habit.level, points: habit.points })}
        />
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <h3 className="text-xs text-muted-foreground">
            {t("habits.detail.heatmapTitle", { count: habit.heatmap.length })}
          </h3>
          <div className="flex flex-1 items-center justify-center">
            <HeatmapGrid days={habit.heatmap} size="lg" />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <HeatmapKey className="bg-muted" label={t("habits.detail.statusNotDone")} />
            <HeatmapKey
              className="bg-emerald-300 dark:bg-emerald-800"
              label={t("habits.detail.statusPartial")}
            />
            <HeatmapKey className="bg-emerald-500" label={t("habits.detail.statusDone")} />
          </div>
        </section>

        <WeekComparisonChart days={habit.heatmap} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">
            {t("habits.detail.records")}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {t("habits.detail.summary", { count: habitEntries.length })}
              {missedCount > 0 && (
                <>
                  {" · "}
                  {t(byWeek ? "habits.detail.missedWeeks" : "habits.detail.missedDays", {
                    count: missedCount,
                  })}
                </>
              )}
            </span>
          </h3>
          <div className="flex flex-wrap items-center gap-4">
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
                  {value === "missed" && (
                    <span className="ml-1 tabular-nums opacity-70">({missedCount})</span>
                  )}
                </button>
              ))}
            </fieldset>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {byWeek && habit.schedule.type === "timesPerWeek"
            ? t("habits.detail.missedHintWeek", { count: habit.schedule.count })
            : t("habits.detail.missedHintDay")}
        </p>

        {allRows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t("habits.detail.none")}
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t("habits.detail.noneFiltered")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
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
                {shown.map(({ date, status, entry, week }) => {
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
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              {t("habits.detail.previous")}
            </Button>
            <span className="text-muted-foreground tabular-nums">
              {t("habits.detail.page", { page: current + 1, pages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              {t("habits.detail.next")}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function HeatmapKey({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-[2px]", className)} />
      {label}
    </span>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];
const same = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().every((day, i) => day === [...b].sort()[i]);

/** "Every day", "Weekdays (Mon–Fri)", "Mon, Wed, Fri", "3 times a week", "Every 2 days". */
function describeSchedule(schedule: HabitSchedule, t: TFunction): string {
  switch (schedule.type) {
    case "daily":
      return t("habits.schedule.daily");
    case "timesPerWeek":
      return t("habits.detail.timesPerWeek", { count: schedule.count });
    case "interval":
      return t("habits.detail.everyNDays", { count: schedule.everyNDays });
    case "weekly": {
      if (same(schedule.daysOfWeek, WEEKDAYS)) return t("habits.schedule.weekdays");
      if (same(schedule.daysOfWeek, WEEKENDS)) return t("habits.schedule.weekends");
      // Monday-first, named in the UI language (2026-01-04 was a Sunday).
      return [...schedule.daysOfWeek]
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((day) => fromIsoDate(`2026-01-${String(4 + day).padStart(2, "0")}`))
        .map((date) => formatWeekday(date))
        .join(", ");
    }
  }
}
