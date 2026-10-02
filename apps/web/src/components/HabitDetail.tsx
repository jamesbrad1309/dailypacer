import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { ArrowLeft, Check, Clock, Flame, Star, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { EditHabitDialog } from "#components/EditHabitDialog";
import { HabitInsights } from "#components/HabitInsights";
import { HabitRecordsTable, RECORDS_PAGE_SIZE } from "#components/HabitRecordsTable";
import { HeatmapGrid } from "#components/HeatmapGrid";
import { WeekComparisonChart } from "#components/WeekComparisonChart";
import { HabitDetailSkeleton } from "#components/layout/Skeletons";
import { Badge } from "#components/ui/badge";
import { HABIT_DETAIL_QUERY, HABIT_RECORDS_QUERY } from "#graphql/habits";
import type { HabitDetailData, HabitRecordsData, HabitSchedule } from "#graphql/types";
import { formatShortDate, formatWeekday, fromIsoDate, todayIsoDate } from "#lib/dates";
import { cn } from "#lib/utils";

/**
 * One habit: what it is, how it's going, and every check-in in a table.
 * Opened by clicking a habit's name on the dashboard (or the History grid).
 */
export function HabitDetail({ habitId }: { habitId: string }) {
  const { t } = useTranslation();
  const { data, loading, error } = useQuery<HabitDetailData>(HABIT_DETAIL_QUERY, {
    variables: { id: habitId },
  });
  // The records table's first page (same variables, so Apollo shares it):
  // read here for the server's "tracked since" day.
  const { data: firstPage } = useQuery<HabitRecordsData>(HABIT_RECORDS_QUERY, {
    variables: {
      habitId,
      today: todayIsoDate(),
      filter: "ALL",
      page: 1,
      pageSize: RECORDS_PAGE_SIZE,
    },
  });

  if (loading && !data) return <HabitDetailSkeleton />;
  if (error || !data) return <p className="text-destructive">{error?.message}</p>;

  const { habit } = data;
  const trackedSince = firstPage?.habitRecords.trackedSince ?? habit.createdAt.slice(0, 10);

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
              date: formatShortDate(trackedSince),
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

      <HabitInsights habitId={habit.id} />

      <HabitRecordsTable habit={habit} />
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
