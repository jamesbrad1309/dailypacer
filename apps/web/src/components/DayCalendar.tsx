import { useQuery } from "@apollo/client/react";
import { Plus } from "lucide-react";
import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";
import { HabitCheck } from "#components/HabitCheck";
import { DayCalendarSkeleton } from "#components/layout/Skeletons";
import { RoutineDialog } from "#components/RoutineDialog";
import { Button } from "#components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#components/ui/card";
import { Progress } from "#components/ui/progress";
import { HABIT_PAGE_FETCH, HABITS_QUERY, ROUTINES_QUERY } from "#graphql/habits";
import type { Habit, HabitsData, Routine } from "#graphql/types";
import { isDoneToday } from "#lib/habit-today";
import { isDueOn, timeToMinutes } from "#lib/schedule";
import { cn } from "#lib/utils";

const START_HOUR = 5;
const END_HOUR = 23;
const HOUR_HEIGHT = 56;

function HabitBlock({ habit, top }: { habit: Habit; top: number }) {
  const done = isDoneToday(habit);
  return (
    <div
      className={cn(
        "absolute right-2 left-16 flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm shadow-sm",
        done ? "border-emerald-500 bg-emerald-500/10" : "bg-card",
      )}
      style={{ top, ...(habit.color && !done && { borderLeft: `4px solid ${habit.color}` }) }}
    >
      <div>
        {habit.icon && (
          <span aria-hidden className="mr-1.5">
            {habit.icon}
          </span>
        )}
        <span className="font-medium">{habit.name}</span>
        <span className="ml-2 text-xs text-muted-foreground">{habit.startTime}</span>
      </div>
      <HabitCheck habit={habit} />
    </div>
  );
}

function AnytimeRow({ habit, next }: { habit: Habit; next?: boolean }) {
  const { t } = useTranslation();
  const done = isDoneToday(habit);
  const id = `anytime-${habit.id}`;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50",
        next && "bg-primary/5 ring-1 ring-primary/30",
      )}
    >
      <HabitCheck habit={habit} id={id} />
      <label
        htmlFor={id}
        className={cn(
          "flex-1 cursor-pointer text-sm",
          done && habit.polarity !== "AVOID" && "text-muted-foreground line-through",
        )}
      >
        {habit.icon && (
          <span aria-hidden className="mr-1.5">
            {habit.icon}
          </span>
        )}
        {habit.name}
        {next && <span className="ml-2 text-xs text-primary">{t("habits.routines.next")}</span>}
      </label>
      {habit.currentStreak > 0 && (
        <span className="text-xs text-muted-foreground">
          🔥 {t("habits.tiles.days", { count: habit.currentStreak })}
        </span>
      )}
    </li>
  );
}

/**
 * A routine as one block: its habits due today, in order, the first one not
 * done yet marked "next", so they're checked off in sequence (any order
 * still works). Its progress sits in the header.
 */
function RoutineBlock({
  routine,
  habits,
  onEdit,
  style,
}: {
  routine: Routine;
  habits: Habit[];
  onEdit: () => void;
  style?: CSSProperties;
}) {
  const { t } = useTranslation();
  const done = habits.filter(isDoneToday).length;
  const nextId = habits.find((h) => !isDoneToday(h))?.id;
  return (
    <section
      aria-label={routine.name}
      className={cn(
        "flex flex-col gap-1 rounded-md border bg-card p-2 text-sm shadow-sm",
        style && "absolute right-2 left-16 z-[1]",
        done === habits.length && "border-emerald-500 bg-emerald-500/5",
      )}
      style={style}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <button type="button" onClick={onEdit} className="text-left font-medium hover:underline">
          {routine.icon && <span className="mr-1.5">{routine.icon}</span>}
          {routine.name}
          {routine.startTime && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {routine.startTime}
            </span>
          )}
        </button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("habits.routines.progress", { done, total: habits.length })}
        </span>
      </div>
      <ol className="flex flex-col">
        {habits.map((habit) => (
          <AnytimeRow key={habit.id} habit={habit} next={habit.id === nextId} />
        ))}
      </ol>
    </section>
  );
}

/**
 * A single-day timeline: habits with a `startTime` are placed at their
 * time-of-day offset (see EditHabitDialog for setting it) and fill the main
 * column; habits without one have no natural vertical position, so they sit
 * in a checklist beside it with today's progress. Only habits actually due
 * today (per their schedule) appear — a Mon/Wed/Fri habit doesn't show up
 * on a Tuesday.
 */
export function DayCalendar() {
  const { t } = useTranslation();
  const { data, loading, error } = useQuery<HabitsData>(HABITS_QUERY, HABIT_PAGE_FETCH);
  const { data: routinesData } = useQuery<{ routines: Routine[] }>(ROUTINES_QUERY);
  const [dialog, setDialog] = useState<{ routine?: Routine } | null>(null);

  if (loading && !data) return <DayCalendarSkeleton />;
  if (error) return <p className="text-destructive">{error.message}</p>;

  const today = new Date();
  const allHabits = data?.habits ?? [];
  const routines = routinesData?.routines ?? [];
  const dueToday = allHabits.filter((habit) => !habit.paused && isDueOn(habit.schedule, today));
  const dueById = new Map(dueToday.map((h) => [h.id, h]));
  // Each routine with its habits due today, in its order; empty ones stay hidden.
  const dueRoutines = routines
    .map((routine) => ({
      routine,
      habits: routine.habitIds.flatMap((id) => dueById.get(id) ?? []),
    }))
    .filter((r) => r.habits.length > 0);
  const inRoutine = new Set(dueRoutines.flatMap((r) => r.habits.map((h) => h.id)));
  const single = dueToday.filter((habit) => !inRoutine.has(habit.id));
  const timed = single
    .filter((habit): habit is Habit & { startTime: string } => habit.startTime != null)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const anytime = single.filter((habit) => habit.startTime == null);
  const timedRoutines = dueRoutines.filter((r) => r.routine.startTime);
  const anytimeRoutines = dueRoutines.filter((r) => !r.routine.startTime);
  const done = dueToday.filter(isDoneToday).length;
  const pct = dueToday.length > 0 ? Math.round((done / dueToday.length) * 100) : 0;

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const nowTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const showNow = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
      <Card className="order-2 lg:order-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("habits.today.schedule")}</CardTitle>
        </CardHeader>
        <CardContent>
          {timed.length === 0 && timedRoutines.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("habits.today.noTimed")}
            </p>
          ) : (
            <div className="relative" style={{ height: hours.length * HOUR_HEIGHT }}>
              {hours.map((hour, i) => (
                <div
                  key={hour}
                  className="absolute inset-x-0 border-t"
                  style={{ top: i * HOUR_HEIGHT }}
                >
                  <span className="-translate-y-1/2 absolute left-0 bg-card pr-2 text-xs text-muted-foreground">
                    {hour.toString().padStart(2, "0")}:00
                  </span>
                </div>
              ))}

              {showNow && (
                <div
                  aria-hidden
                  className="absolute right-0 left-14 z-10 border-t-2 border-rose-500"
                  style={{ top: nowTop }}
                >
                  <span className="-top-[5px] -left-1 absolute size-2 rounded-full bg-rose-500" />
                </div>
              )}

              {timedRoutines.map(({ routine, habits }) => (
                <RoutineBlock
                  key={routine.id}
                  routine={routine}
                  habits={habits}
                  onEdit={() => setDialog({ routine })}
                  style={{
                    top:
                      ((timeToMinutes(routine.startTime as string) - START_HOUR * 60) / 60) *
                      HOUR_HEIGHT,
                  }}
                />
              ))}

              {timed.map((habit) => {
                const minutesFromStart = timeToMinutes(habit.startTime) - START_HOUR * 60;
                return (
                  <HabitBlock
                    key={habit.id}
                    habit={habit}
                    top={(minutesFromStart / 60) * HOUR_HEIGHT}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="order-1 flex flex-col gap-4 lg:sticky lg:top-0 lg:order-2">
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <p className="text-sm text-muted-foreground">{t("habits.today.progress")}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {done}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                {t("habits.today.doneOf", { total: dueToday.length })}
              </span>
            </p>
            <Progress value={pct} className="h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("habits.today.anytime")}</CardTitle>
          </CardHeader>
          <CardContent>
            {anytime.length === 0 && anytimeRoutines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {dueToday.length === 0
                  ? t("habits.today.nothingScheduled")
                  : t("habits.today.allTimed")}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {anytimeRoutines.map(({ routine, habits }) => (
                  <RoutineBlock
                    key={routine.id}
                    routine={routine}
                    habits={habits}
                    onEdit={() => setDialog({ routine })}
                  />
                ))}
                {anytime.length > 0 && (
                  <ul className="-mx-2 flex flex-col">
                    {anytime.map((habit) => (
                      <AnytimeRow key={habit.id} habit={habit} />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">{t("habits.routines.title")}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setDialog({})}>
              <Plus className="size-4" /> {t("habits.routines.new")}
            </Button>
          </CardHeader>
          <CardContent>
            {routines.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("habits.routines.empty")}</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {routines.map((routine) => (
                  <li key={routine.id}>
                    <button
                      type="button"
                      onClick={() => setDialog({ routine })}
                      className="w-full rounded-md px-2 py-1 text-left hover:bg-accent/50"
                    >
                      {routine.icon && <span className="mr-1.5">{routine.icon}</span>}
                      {routine.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t("habits.routines.count", { count: routine.habitIds.length })}
                        {routine.startTime && ` · ${routine.startTime}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <RoutineDialog
          open={dialog !== null}
          onOpenChange={(open) => !open && setDialog(null)}
          routine={dialog?.routine}
          habits={allHabits.filter((h) => !h.paused)}
          routines={routines}
        />
      </div>
    </div>
  );
}
