import { useQuery } from "@apollo/client/react";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, ListChecks, Minus, Smile } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ListSkeleton } from "#components/layout/Skeletons";
import {
  ChartCard,
  DataTable,
  DivergingColumns,
  RankedBars,
  RateLine,
  type Series,
  StackedColumns,
} from "#components/progress/charts";
import { Card, CardContent } from "#components/ui/card";
import { JOURNAL_FEELINGS_QUERY } from "#graphql/journal";
import { HABIT_PROGRESS_QUERY, TASK_PROGRESS_QUERY } from "#graphql/progress";
import type { HabitProgressData, JournalFeeling, TaskProgressData } from "#graphql/types";
import { useLexicon } from "#hooks/useLexicon";
import { addDays, formatShortDate, startOfWeek, todayIsoDate } from "#lib/dates";
import { moodByDay } from "#lib/habit-mood";
import { formatMood, moodBand } from "#lib/mood";
import {
  halves,
  moodByHabitDays,
  moodByWeek,
  PERIODS,
  type Period,
  rateOf,
  topWithOther,
} from "#lib/progress";
import { cn } from "#lib/utils";

/** Categorical slots in fixed order; a ninth series folds into "Other". */
const SLOTS = [
  "bg-viz-series-1",
  "bg-viz-series-2",
  "bg-viz-series-3",
  "bg-viz-series-4",
  "bg-viz-series-5",
  "bg-viz-series-6",
  "bg-viz-series-7",
  "bg-viz-series-8",
];
const OTHER = "bg-muted-foreground/40";

const pct = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)}%`);

/**
 * How you're doing over the last 4, 12 or 26 weeks, against the same
 * stretch before it: habit completion week by week, check-ins by habit,
 * each habit's rate, tasks finished (on time or late), mood by week, and
 * your mood on strong habit days against light ones.
 */
export function ProgressView({
  weeks,
  onWeeksChange,
}: {
  weeks: Period;
  onWeeksChange: (weeks: Period) => void;
}) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const lexicon = useLexicon();
  const vars = { weeks: weeks * 2, today };
  const habitsQ = useQuery<HabitProgressData>(HABIT_PROGRESS_QUERY, { variables: vars });
  const tasksQ = useQuery<TaskProgressData>(TASK_PROGRESS_QUERY, { variables: vars });
  const firstMonday = addDays(startOfWeek(today), -7 * (weeks * 2 - 1));
  const feelingsQ = useQuery<{ journalFeelings: JournalFeeling[] }>(JOURNAL_FEELINGS_QUERY, {
    variables: { from: firstMonday, to: today },
  });

  const habits = habitsQ.data?.habitProgress;
  const tasks = tasksQ.data?.taskProgress;
  if (!habits || !tasks) {
    return habitsQ.error || tasksQ.error ? (
      <p className="text-destructive">{(habitsQ.error ?? tasksQ.error)?.message}</p>
    ) : (
      <ListSkeleton rows={5} />
    );
  }

  const thisWeek = startOfWeek(today);
  const weekTitle = (start: string) =>
    start === thisWeek
      ? t("progress.thisWeek")
      : t("progress.weekOf", {
          from: formatShortDate(start),
          to: formatShortDate(addDays(start, 6)),
        });

  // Habits: this period and the one before.
  const habitWeeks = halves(habits.weeks, weeks);
  const habitRate = rateOf(habitWeeks.current);
  const previousRate = rateOf(habitWeeks.previous);
  const checkIns = habitWeeks.current.reduce((s, w) => s + w.done, 0);
  const previousCheckIns = habitWeeks.previous.reduce((s, w) => s + w.done, 0);
  const perHabit = habits.habits.map((h) => {
    const current = h.perWeek.slice(-weeks);
    const done = current.reduce((s, n) => s + n, 0);
    return { ...h, current, done };
  });
  // Each habit's rate over the shown weeks.
  const rateRows = habits.habits
    .map((h) => {
      const done = h.perWeek.slice(-weeks).reduce((s, n) => s + n, 0);
      const due = h.perWeekDue.slice(-weeks).reduce((s, n) => s + n, 0);
      return {
        key: h.id,
        label: h.name,
        value: due > 0 ? Math.min(1, done / due) : null,
        detail: t("progress.doneOf", { done, due }),
      };
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const { shown, other } = topWithOther(perHabit, SLOTS.length);
  const habitSeries: Series[] = [
    ...shown.map((h, i) => ({ key: h.id, label: h.name, className: SLOTS[i] })),
    ...(other.length > 0
      ? [
          {
            key: "other",
            label: t("progress.otherHabits", { count: other.length }),
            className: OTHER,
          },
        ]
      : []),
  ];

  // Tasks.
  const taskWeeks = halves(tasks.weeks, weeks);
  const completed = taskWeeks.current.reduce((s, w) => s + w.completed, 0);
  const previousCompleted = taskWeeks.previous.reduce((s, w) => s + w.completed, 0);
  const withDue = taskWeeks.current.reduce((s, w) => s + w.onTime + w.late, 0);
  const onTime = taskWeeks.current.reduce((s, w) => s + w.onTime, 0);
  const taskSeries: Series[] = [
    { key: "onTime", label: t("progress.onTime"), className: SLOTS[0] },
    { key: "noDueDate", label: t("progress.noDueDate"), className: SLOTS[2] },
    { key: "late", label: t("progress.late"), className: SLOTS[1] },
  ];

  // Mood.
  const scores = moodByDay(feelingsQ.data?.journalFeelings ?? [], lexicon);
  const allMood = moodByWeek(
    scores,
    habits.weeks.map((w) => w.weekStart),
  );
  const moodWeeks = halves(allMood, weeks);
  const average = (list: typeof allMood) => {
    const days = list.reduce((s, w) => s + w.days, 0);
    return days > 0 ? list.reduce((s, w) => s + (w.mood ?? 0) * w.days, 0) / days : null;
  };
  const mood = average(moodWeeks.current);
  const previousMood = average(moodWeeks.previous);
  const shownDays = habits.days.filter((d) => d.date >= habitWeeks.current[0]?.weekStart);
  const moodVsHabits = moodByHabitDays(shownDays, scores);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex rounded-lg border p-0.5 text-sm">
          <legend className="sr-only">{t("progress.period")}</legend>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={weeks === p}
              onClick={() => onWeeksChange(p)}
              className={cn(
                "h-8 rounded-md px-3 font-medium",
                weeks === p
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("progress.weeks", { count: p })}
            </button>
          ))}
        </fieldset>
        <p className="text-xs text-muted-foreground">
          {t("progress.comparedWith", { count: weeks })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          icon={<CheckCircle2 className="size-4 text-emerald-500" />}
          label={t("progress.habitRate")}
          value={pct(habitRate)}
          change={
            habitRate !== null && previousRate !== null ? (habitRate - previousRate) * 100 : null
          }
          unit={t("progress.pts")}
        />
        <Kpi
          icon={<CheckCircle2 className="size-4 text-emerald-500" />}
          label={t("progress.checkIns")}
          value={String(checkIns)}
          change={previousCheckIns > 0 ? checkIns - previousCheckIns : null}
        />
        <Kpi
          icon={<ListChecks className="size-4 text-sky-500" />}
          label={t("progress.tasksDone")}
          value={String(completed)}
          change={previousCompleted > 0 ? completed - previousCompleted : null}
          note={
            withDue > 0 ? t("progress.onTimeShare", { share: pct(onTime / withDue) }) : undefined
          }
        />
        <Kpi
          icon={<Smile className="size-4 text-teal-600" />}
          label={t("progress.mood")}
          value={mood === null ? "—" : formatMood(mood)}
          note={mood === null ? t("progress.noMood") : t(`journal.mood.bands.${moodBand(mood)}`)}
          change={mood !== null && previousMood !== null ? (mood - previousMood) * 10 : null}
          format={(n) => (n / 10).toFixed(1)}
        />
      </div>

      <ChartCard
        id="habit-rate"
        title={t("progress.habitRateTitle")}
        subtitle={t("progress.habitRateSubtitle")}
        summary={
          <span className="text-muted-foreground">
            {previousRate === null
              ? t("progress.habitRateOnly", { rate: pct(habitRate) })
              : t("progress.habitRateSummary", {
                  rate: pct(habitRate),
                  previous: pct(previousRate),
                })}
          </span>
        }
        table={
          <DataTable
            head={[t("progress.week"), t("progress.done"), t("progress.due"), t("progress.rate")]}
            rows={[...habitWeeks.current]
              .reverse()
              .map((w) => [weekTitle(w.weekStart), w.done, w.due, pct(w.rate)])}
          />
        }
      >
        <RateLine
          points={habitWeeks.current.map((w) => ({
            key: w.weekStart,
            label: formatShortDate(w.weekStart),
            title: weekTitle(w.weekStart),
            value: w.rate,
            detail: t("progress.doneOf", { done: w.done, due: w.due }),
            partial: w.weekStart === thisWeek,
          }))}
          reference={previousRate}
          referenceLabel={t("progress.previousAverage", { rate: pct(previousRate) })}
        />
      </ChartCard>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ChartCard
          id="check-ins"
          title={t("progress.checkInsTitle")}
          subtitle={t("progress.checkInsSubtitle")}
          legend={habitSeries.map((s) => ({ className: s.className, label: s.label }))}
          table={
            <DataTable
              head={[t("progress.week"), ...habitSeries.map((s) => s.label)]}
              rows={habitWeeks.current
                .map((w, i) => [
                  weekTitle(w.weekStart),
                  ...shown.map((h) => h.current[i] ?? 0),
                  ...(other.length > 0 ? [other.reduce((s, h) => s + (h.current[i] ?? 0), 0)] : []),
                ])
                .reverse()}
            />
          }
        >
          {perHabit.length === 0 ? (
            <Empty>{t("progress.noHabits")}</Empty>
          ) : (
            <StackedColumns
              series={habitSeries}
              totalLabel={t("progress.total")}
              ariaLabel={(c, total) =>
                `${c.title}: ${t("progress.checkInsCount", { count: total })}`
              }
              columns={habitWeeks.current.map((w, i) => ({
                key: w.weekStart,
                label: formatShortDate(w.weekStart),
                title: weekTitle(w.weekStart),
                partial: w.weekStart === thisWeek,
                values: Object.fromEntries([
                  ...shown.map((h) => [h.id, h.current[i] ?? 0]),
                  ["other", other.reduce((s, h) => s + (h.current[i] ?? 0), 0)],
                ]),
              }))}
            />
          )}
        </ChartCard>

        <ChartCard
          id="by-habit"
          title={t("progress.byHabitTitle")}
          subtitle={t("progress.byHabitSubtitle", { count: weeks })}
          table={
            <DataTable
              head={[t("progress.habit"), t("progress.rate"), t("progress.done")]}
              rows={rateRows.map((r) => [r.label, pct(r.value), r.detail])}
            />
          }
        >
          {rateRows.length === 0 ? (
            <Empty>{t("progress.noHabits")}</Empty>
          ) : (
            <RankedBars rows={rateRows} />
          )}
        </ChartCard>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <ChartCard
          id="tasks"
          title={t("progress.tasksTitle")}
          subtitle={t("progress.tasksSubtitle")}
          legend={taskSeries.map((s) => ({ className: s.className, label: s.label }))}
          summary={
            tasks.overdueNow > 0 ? (
              <span className="text-amber-700 dark:text-amber-400">
                {t("progress.overdueNow", { count: tasks.overdueNow })}
              </span>
            ) : undefined
          }
          table={
            <DataTable
              head={[
                t("progress.week"),
                t("progress.onTime"),
                t("progress.noDueDate"),
                t("progress.late"),
                t("progress.total"),
              ]}
              rows={[...taskWeeks.current]
                .reverse()
                .map((w) => [weekTitle(w.weekStart), w.onTime, w.noDueDate, w.late, w.completed])}
            />
          }
        >
          {completed === 0 && previousCompleted === 0 ? (
            <Empty>{t("progress.noTasks")}</Empty>
          ) : (
            <StackedColumns
              series={taskSeries}
              totalLabel={t("progress.total")}
              ariaLabel={(c, total) => `${c.title}: ${t("progress.tasksCount", { count: total })}`}
              columns={taskWeeks.current.map((w) => ({
                key: w.weekStart,
                label: formatShortDate(w.weekStart),
                title: weekTitle(w.weekStart),
                partial: w.weekStart === thisWeek,
                values: { onTime: w.onTime, noDueDate: w.noDueDate, late: w.late },
              }))}
            />
          )}
        </ChartCard>

        <ChartCard
          id="mood"
          title={t("progress.moodTitle")}
          subtitle={t("progress.moodSubtitle")}
          table={
            <DataTable
              head={[t("progress.week"), t("progress.mood"), t("progress.daysLogged")]}
              rows={[...moodWeeks.current]
                .reverse()
                .map((w) => [
                  weekTitle(w.weekStart),
                  w.mood === null ? "—" : formatMood(w.mood),
                  w.days,
                ])}
            />
          }
        >
          {moodWeeks.current.every((w) => w.mood === null) ? (
            <Empty>{t("progress.noMood")}</Empty>
          ) : (
            <DivergingColumns
              points={moodWeeks.current.map((w) => ({
                key: w.weekStart,
                label: formatShortDate(w.weekStart),
                title: weekTitle(w.weekStart),
                value: w.mood,
                detail:
                  w.mood === null
                    ? t("progress.noFeelingsThatWeek")
                    : `${formatMood(w.mood)} (${t(`journal.mood.bands.${moodBand(w.mood)}`)}) · ${t("progress.daysLoggedCount", { count: w.days })}`,
              }))}
            />
          )}
        </ChartCard>
      </div>

      <section
        className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5"
        aria-labelledby="mood-habits"
      >
        <div>
          <h2 id="mood-habits" className="text-sm font-medium">
            {t("progress.moodHabitsTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("progress.moodHabitsSubtitle")}</p>
        </div>
        {moodVsHabits.strong && moodVsHabits.light ? (
          <>
            <ul className="flex flex-col gap-3">
              {(
                [
                  ["strong", moodVsHabits.strong],
                  ["light", moodVsHabits.light],
                ] as const
              ).map(([key, group]) => (
                <li
                  key={key}
                  className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm"
                >
                  <span>{t(`progress.${key}Days`)}</span>
                  <span className="relative h-3 rounded-full bg-muted" aria-hidden>
                    <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" />
                    <span
                      className={cn(
                        "absolute inset-y-0",
                        group.mood >= 0
                          ? "left-1/2 rounded-r-full bg-teal-600/80"
                          : "right-1/2 rounded-l-full bg-orange-600/80",
                      )}
                      style={{ width: `${Math.abs(group.mood) * 50}%` }}
                    />
                  </span>
                  <span className="tabular-nums">
                    {formatMood(group.mood)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t("progress.daysCount", { count: group.days })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm">
              {moodVsHabits.strong.mood > moodVsHabits.light.mood + 0.1
                ? t("progress.moodHabitsBetter")
                : moodVsHabits.strong.mood < moodVsHabits.light.mood - 0.1
                  ? t("progress.moodHabitsWorse")
                  : t("progress.moodHabitsSame")}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("progress.moodHabitsNotYet")}</p>
        )}
      </section>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  change,
  unit,
  note,
  format = (n) => String(Math.round(n)),
}: {
  icon: ReactNode;
  label: string;
  value: string;
  /** Against the period before; null when there's nothing to compare. */
  change: number | null;
  unit?: string;
  note?: string;
  format?: (n: number) => string;
}) {
  const { t } = useTranslation();
  const rounded = change === null ? null : Math.round(change * 10) / 10;
  const Arrow =
    rounded === null || rounded === 0 ? Minus : rounded > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Card className="gap-0">
      <CardContent className="flex flex-col gap-1.5 p-4">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {rounded !== null && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs",
              rounded > 0
                ? "text-status-good"
                : rounded < 0
                  ? "text-status-critical"
                  : "text-muted-foreground",
            )}
          >
            <Arrow className="size-3.5" aria-hidden />
            {rounded === 0
              ? t("progress.same")
              : t(rounded > 0 ? "progress.up" : "progress.down", {
                  amount: `${format(Math.abs(rounded))}${unit ? ` ${unit}` : ""}`,
                })}
          </span>
        )}
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
