import { useMutation, useQuery } from "@apollo/client/react";
import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Minus,
  Pause,
  Snowflake,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ListSkeleton } from "#components/layout/Skeletons";
import { Button } from "#components/ui/button";
import {
  DASHBOARD_STATS_QUERY,
  HABITS_QUERY,
  HABIT_CALENDAR_QUERY,
  HABIT_PROGRESS_REFETCH,
  UPSERT_HABIT_ENTRY_MUTATION,
} from "#graphql/habits";
import type {
  Habit,
  HabitCalendarData,
  HabitDayCell,
  HabitDayStatus,
  HabitsData,
} from "#graphql/types";
import {
  addDays,
  addMonths,
  formatMonth,
  formatShortDate,
  formatWeekday,
  fromIsoDate,
  monthGridRange,
  startOfWeek,
  todayIsoDate,
} from "#lib/dates";
import { cn } from "#lib/utils";

export interface HabitCalendarSearch {
  view: "week" | "month";
  /** Any day in the week or month shown; today when missing. */
  date?: string;
  /** Month view: the day whose habits are listed under the grid. */
  day?: string;
}

/** Each status has an icon and a label, never colour alone. */
const STATUS: Record<HabitDayStatus, { icon: typeof Check | null; className: string }> = {
  DONE: { icon: Check, className: "bg-emerald-500 text-white" },
  PARTIAL: {
    icon: Minus,
    className: "bg-emerald-300 text-emerald-950 dark:bg-emerald-800 dark:text-emerald-100",
  },
  SLIPPED: { icon: Ban, className: "bg-orange-500/80 text-white" },
  MISSED: {
    icon: X,
    className: "border border-dashed border-muted-foreground/50 text-muted-foreground",
  },
  DUE: { icon: Circle, className: "border text-muted-foreground" },
  FROZEN: { icon: Snowflake, className: "bg-sky-400/30 text-sky-800 dark:text-sky-300" },
  PAUSED: { icon: Pause, className: "bg-muted text-muted-foreground" },
  OFF: { icon: null, className: "text-muted-foreground/40" },
  NONE: { icon: null, className: "" },
};

/** Days a click can change: today and earlier, tracked and not paused or frozen. */
const EDITABLE = new Set<HabitDayStatus>(["DONE", "PARTIAL", "SLIPPED", "MISSED", "DUE", "OFF"]);

/**
 * Habits across a week (a row each, Monday to Sunday) or a month (a grid of
 * days with how many were done, and the chosen day's habits below). Past
 * days and today can be ticked or unticked from here; avoid habits toggle a
 * slip.
 */
export function HabitCalendarView({
  search,
  onSearchChange,
}: {
  search: HabitCalendarSearch;
  onSearchChange: (next: Partial<HabitCalendarSearch>) => void;
}) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const anchor = search.date ?? today;
  const month = anchor.slice(0, 7);
  const range =
    search.view === "week"
      ? { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 6) }
      : monthGridRange(month);
  const { data, loading, error } = useQuery<HabitCalendarData>(HABIT_CALENDAR_QUERY, {
    variables: { ...range, today },
  });
  const { data: habitsData } = useQuery<HabitsData>(HABITS_QUERY);
  const habits = habitsData?.habits ?? [];
  const rows = data?.habitCalendar ?? [];
  const cellsFor = (habitId: string) => rows.find((r) => r.habitId === habitId)?.days ?? [];

  const step = (by: number) =>
    onSearchChange({
      date:
        search.view === "week"
          ? addDays(startOfWeek(anchor), by * 7)
          : `${addMonths(month, by)}-01`,
      day: undefined,
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5 text-sm" role="tablist">
          {(["week", "month"] as const).map((view) => (
            <button
              key={view}
              type="button"
              role="tab"
              aria-selected={search.view === view}
              onClick={() => onSearchChange({ view, day: undefined })}
              className={cn(
                "h-8 rounded-md px-3 font-medium",
                search.view === view
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`habits.calendar.${view}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("habits.calendar.previous")}
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">
            {search.view === "week"
              ? t("habits.calendar.weekOf", {
                  from: formatShortDate(range.from),
                  to: formatShortDate(range.to),
                })
              : formatMonth(month)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("habits.calendar.next")}
            onClick={() => step(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {anchor !== today && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSearchChange({ date: undefined, day: undefined })}
          >
            {t("common.today")}
          </Button>
        )}
      </div>

      {error && <p className="text-destructive">{error.message}</p>}
      {loading && !data ? (
        <ListSkeleton rows={5} />
      ) : habits.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("habits.calendar.noHabits")}
        </p>
      ) : search.view === "week" ? (
        <WeekGrid habits={habits} cellsFor={cellsFor} from={range.from} today={today} />
      ) : (
        <MonthGrid
          habits={habits}
          cellsFor={cellsFor}
          range={range}
          month={month}
          today={today}
          selected={search.day ?? (today.startsWith(month) ? today : null)}
          onSelect={(day) => onSearchChange({ day })}
        />
      )}
      <Legend />
    </div>
  );
}

function Legend() {
  const { t } = useTranslation();
  const shown: HabitDayStatus[] = [
    "DONE",
    "PARTIAL",
    "MISSED",
    "DUE",
    "SLIPPED",
    "FROZEN",
    "PAUSED",
  ];
  return (
    <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {shown.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <StatusDot status={status} />
          {t(`habits.calendar.status.${status}`)}
        </li>
      ))}
    </ul>
  );
}

function StatusDot({ status, className }: { status: HabitDayStatus; className?: string }) {
  const { icon: Icon, className: tone } = STATUS[status];
  return (
    <span className={cn("flex size-5 items-center justify-center rounded-md", tone, className)}>
      {Icon && <Icon className="size-3" aria-hidden />}
    </span>
  );
}

/** One day's cell for one habit: a button on days that can be ticked. */
function DayButton({ habit, cell, today }: { habit: Habit; cell: HabitDayCell; today: string }) {
  const { t } = useTranslation();
  const [upsert, saving] = useMutation(UPSERT_HABIT_ENTRY_MUTATION, {
    refetchQueries: [
      { query: HABITS_QUERY },
      { query: DASHBOARD_STATS_QUERY },
      ...HABIT_PROGRESS_REFETCH,
    ],
  });
  const avoid = habit.polarity === "AVOID";
  const label = t("habits.calendar.cellLabel", {
    name: habit.name,
    date: formatShortDate(cell.date),
    status: t(`habits.calendar.status.${cell.status}`),
  });
  const editable =
    cell.date <= today && EDITABLE.has(cell.status) && (cell.status !== "OFF" || !avoid);
  if (!editable) {
    return (
      <span role="img" aria-label={label} title={label} className="flex justify-center">
        <StatusDot status={cell.status} />
      </span>
    );
  }
  const done = cell.status === "DONE";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={avoid ? cell.status === "SLIPPED" : done}
      disabled={saving.loading}
      className="flex justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() =>
        upsert({
          variables: {
            input: avoid
              ? {
                  habitId: habit.id,
                  date: cell.date,
                  completed: false,
                  value: cell.status === "SLIPPED" ? 0 : 1,
                }
              : { habitId: habit.id, date: cell.date, completed: !done },
          },
        })
      }
    >
      <StatusDot status={cell.status} className="hover:ring-2 hover:ring-ring/40" />
    </button>
  );
}

function WeekGrid({
  habits,
  cellsFor,
  from,
  today,
}: {
  habits: Habit[];
  cellsFor: (habitId: string) => HabitDayCell[];
  from: string;
  today: string;
}) {
  const { t } = useTranslation();
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[36rem] text-sm">
        <caption className="sr-only">{t("habits.calendar.weekCaption")}</caption>
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {t("habits.calendar.habit")}
            </th>
            {days.map((day) => (
              <th
                key={day}
                scope="col"
                className={cn(
                  "px-1 py-2 text-center font-medium",
                  day === today && "text-foreground",
                )}
              >
                <span className="block">{formatWeekday(fromIsoDate(day))}</span>
                <span className="block tabular-nums">{Number(day.slice(8))}</span>
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-medium">
              {t("habits.calendar.done")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {habits.map((habit) => {
            const cells = cellsFor(habit.id);
            const done = cells.filter((c) => c.status === "DONE").length;
            const due = cells.filter((c) =>
              ["DONE", "PARTIAL", "MISSED", "DUE", "SLIPPED"].includes(c.status),
            ).length;
            return (
              <tr key={habit.id}>
                <th scope="row" className="max-w-48 truncate px-3 py-2 text-left font-normal">
                  {habit.name}
                </th>
                {days.map((day) => {
                  const cell = cells.find((c) => c.date === day);
                  return (
                    <td key={day} className={cn("px-1 py-2", day === today && "bg-accent/40")}>
                      {cell && <DayButton habit={habit} cell={cell} today={today} />}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">
                  {habit.schedule.type === "timesPerWeek"
                    ? `${done}/${habit.schedule.count}`
                    : `${done}/${due}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MonthGrid({
  habits,
  cellsFor,
  range,
  month,
  today,
  selected,
  onSelect,
}: {
  habits: Habit[];
  cellsFor: (habitId: string) => HabitDayCell[];
  range: { from: string; to: string };
  month: string;
  today: string;
  selected: string | null;
  onSelect: (day: string) => void;
}) {
  const { t } = useTranslation();
  const days: string[] = [];
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) days.push(day);
  const statusOn = (day: string) => habits.map((h) => cellsFor(h.id).find((c) => c.date === day));
  const tally = (day: string) => {
    const cells = statusOn(day).filter((c): c is HabitDayCell => Boolean(c));
    const done = cells.filter((c) => c.status === "DONE").length;
    const due = cells.filter((c) =>
      ["DONE", "PARTIAL", "MISSED", "DUE", "SLIPPED"].includes(c.status),
    ).length;
    return { done, due };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-1 rounded-xl border bg-card p-2">
        {days.slice(0, 7).map((day) => (
          <div
            key={`h-${day}`}
            aria-hidden
            className="pb-1 text-center text-xs text-muted-foreground"
          >
            {formatWeekday(fromIsoDate(day))}
          </div>
        ))}
        {days.map((day) => {
          const { done, due } = tally(day);
          const inMonth = day.startsWith(month);
          const share = due > 0 ? done / due : null;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected === day}
              aria-label={t("habits.calendar.dayLabel", { date: formatShortDate(day), done, due })}
              onClick={() => onSelect(day)}
              className={cn(
                "flex min-h-16 flex-col items-start gap-1 rounded-md border p-1.5 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !inMonth && "opacity-40",
                selected === day && "ring-2 ring-primary",
                day === today && "border-primary",
              )}
            >
              <span className="font-medium tabular-nums">{Number(day.slice(8))}</span>
              {due > 0 && day <= today && (
                <>
                  <span className="tabular-nums text-muted-foreground">
                    {done}/{due}
                  </span>
                  <span className="h-1 w-full rounded-full bg-muted" aria-hidden>
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        share === 1 ? "bg-emerald-500" : "bg-emerald-500/60",
                      )}
                      style={{ width: `${(share ?? 0) * 100}%` }}
                    />
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-medium">{formatShortDate(selected)}</h3>
          <ul className="flex flex-col gap-1.5">
            {habits.map((habit) => {
              const cell = cellsFor(habit.id).find((c) => c.date === selected);
              if (!cell || cell.status === "NONE") return null;
              return (
                <li key={habit.id} className="flex items-center gap-3 text-sm">
                  <DayButton habit={habit} cell={cell} today={today} />
                  <span className="flex-1">{habit.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`habits.calendar.status.${cell.status}`)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
