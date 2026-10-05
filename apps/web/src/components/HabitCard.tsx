import { useMutation } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { Archive, Ban, CalendarClock, Clock, Flame, Pause, Play, Star } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EditHabitDialog } from "#components/EditHabitDialog";
import { HeatmapGrid } from "#components/HeatmapGrid";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#components/ui/card";
import { Checkbox } from "#components/ui/checkbox";
import { Input } from "#components/ui/input";
import {
  ARCHIVED_HABITS_QUERY,
  ARCHIVE_HABIT_MUTATION,
  DASHBOARD_STATS_QUERY,
  HABITS_QUERY,
  HABIT_PROGRESS_REFETCH,
  PAUSE_HABIT_MUTATION,
  RESUME_HABIT_MUTATION,
  UPSERT_HABIT_ENTRY_MUTATION,
} from "#graphql/habits";
import type { Habit } from "#graphql/types";
import { useStreakCelebration } from "#hooks/useStreakCelebration";
import { daysBetween, formatShortDate, todayIsoDate } from "#lib/dates";
import { cn } from "#lib/utils";

interface Props {
  habit: Habit;
  /** Called with a tag when its chip is clicked, to filter the dashboard by it. */
  onTagClick?: (tag: string) => void;
}

export function HabitCard({ habit, onTagClick }: Props) {
  const { t } = useTranslation();
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  // Any of these can change dashboardStats (points/streaks aggregate across
  // all habits), which Apollo's cache normalization can't infer on its own
  // since DashboardStats isn't keyed by habit id — refetch it explicitly.
  // "HabitRecords" by name: a habit's detail page (if it's been opened) shows
  // its check-ins and misses, which all of these change.
  const refetchQueries = [{ query: DASHBOARD_STATS_QUERY }, ...HABIT_PROGRESS_REFETCH];
  // Archiving removes a row from the `habits` list query's array, which
  // normalization also can't do on its own (it only updates existing
  // entities, never a list's membership) — refetch both lists it moves between.
  const refetchList = [
    ...refetchQueries,
    { query: HABITS_QUERY },
    { query: ARCHIVED_HABITS_QUERY },
  ];

  const [upsertEntry] = useMutation(UPSERT_HABIT_ENTRY_MUTATION, { refetchQueries });
  const [pauseHabit] = useMutation(PAUSE_HABIT_MUTATION, { refetchQueries });
  const [resumeHabit] = useMutation(RESUME_HABIT_MUTATION, { refetchQueries });
  const [archiveHabit] = useMutation(ARCHIVE_HABIT_MUTATION, { refetchQueries: refetchList });

  const entry = habit.todayEntry;
  const arm = useStreakCelebration(habit);
  const avoid = habit.polarity === "AVOID";
  // An avoid habit's slip: not done, with slips counted in `value`.
  const slipped = avoid && !entry?.completed && (entry?.value ?? 0) > 0;
  const daysLeft = habit.endDate ? daysBetween(todayIsoDate(), habit.endDate) + 1 : null;

  return (
    <Card className={cn(habit.paused && "opacity-60")}>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">
            <Link
              to="/habits/$habitId"
              params={{ habitId: habit.id }}
              title={t("habits.detail.open", { name: habit.name })}
              className="hover:underline"
            >
              {habit.name}
            </Link>
          </CardTitle>
          {habit.description && (
            <p
              className="mt-1 line-clamp-2 text-sm text-muted-foreground"
              title={habit.description}
            >
              {habit.description}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="gap-1">
              <Star className="size-3" />
              {t("habits.card.level", { level: habit.level, points: habit.points })}
            </Badge>
            {habit.paused && <Badge variant="outline">{t("habits.card.paused")}</Badge>}
            {avoid && (
              <Badge variant="outline" className="gap-1">
                <Ban className="size-3" />
                {t("habits.card.avoid")}
              </Badge>
            )}
            {habit.endDate && daysLeft !== null && (
              <Badge
                variant="outline"
                className="gap-1"
                title={t("habits.card.endsOn", { date: formatShortDate(habit.endDate) })}
              >
                <CalendarClock className="size-3" />
                {t("habits.card.daysLeft", { count: daysLeft })}
              </Badge>
            )}
            {habit.startTime && (
              <Badge variant="outline" className="gap-1">
                <Clock className="size-3" />
                {habit.startTime}
              </Badge>
            )}
            {habit.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                title={t("habits.card.filterByTag", { tag })}
                className="rounded-md text-xs text-sky-600 hover:underline dark:text-sky-400"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div
            className="flex flex-col items-center leading-none"
            title={t("habits.card.best", { count: habit.longestStreak })}
          >
            <span
              className={cn(
                "flex items-center gap-0.5 text-xl font-semibold tabular-nums",
                habit.currentStreak > 0 ? "text-amber-500" : "text-muted-foreground",
              )}
            >
              <Flame className="size-4" />
              {habit.currentStreak}
            </span>
            <span className="mt-1 text-[10px] text-muted-foreground">
              {t("habits.card.streakLabel")}
            </span>
          </div>
          {avoid ? (
            <Button
              size="sm"
              variant={slipped ? "destructive" : "outline"}
              aria-pressed={slipped}
              disabled={habit.paused}
              onClick={() =>
                upsertEntry({
                  variables: {
                    input: {
                      habitId: habit.id,
                      date: todayIsoDate(),
                      completed: false,
                      value: slipped ? 0 : 1,
                    },
                  },
                })
              }
            >
              {slipped ? t("habits.card.slipped") : t("habits.card.slip")}
            </Button>
          ) : (
            <Checkbox
              checked={entry?.completed ?? false}
              disabled={habit.paused}
              aria-label={t("habits.card.doneToday", { name: habit.name })}
              onCheckedChange={(checked) => {
                if (checked === true) arm();
                upsertEntry({
                  variables: {
                    input: {
                      habitId: habit.id,
                      date: todayIsoDate(),
                      completed: checked === true,
                      value: entry?.value ?? undefined,
                    },
                  },
                });
              }}
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {habit.unit && !avoid ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Input
              type="number"
              className="w-24"
              defaultValue={entry?.value ?? ""}
              placeholder="0"
              disabled={habit.paused}
              onBlur={(e) => {
                const value = e.target.value === "" ? undefined : Number(e.target.value);
                upsertEntry({
                  variables: {
                    input: {
                      habitId: habit.id,
                      date: todayIsoDate(),
                      value,
                      completed: entry?.completed ?? false,
                    },
                  },
                });
              }}
            />
            <span>
              {habit.unit}
              {habit.targetValue ? ` / ${habit.targetValue}` : ""}
            </span>
          </div>
        ) : null}

        <Input
          aria-label={t("habits.card.note")}
          placeholder={t("habits.card.notePlaceholder")}
          maxLength={2000}
          className="h-8 text-sm"
          defaultValue={entry?.note ?? ""}
          disabled={habit.paused}
          onBlur={(e) => {
            const note = e.target.value.trim();
            if (note === (entry?.note ?? "")) return;
            // Upsert keeps the entry's value and completion when they're
            // left out, and "" clears the note (null would mean "unchanged").
            upsertEntry({
              variables: { input: { habitId: habit.id, date: todayIsoDate(), note } },
            });
          }}
        />

        <HeatmapGrid days={habit.heatmap} />

        <p className="text-xs text-muted-foreground">
          {t("habits.card.best", { count: habit.longestStreak })} ·{" "}
          {t("habits.card.checkIns", { count: habit.totalCompletions })}
        </p>

        <div className="flex justify-end gap-1 border-t pt-2">
          <EditHabitDialog habit={habit} />
          {habit.paused ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resumeHabit({ variables: { id: habit.id, date: todayIsoDate() } })}
            >
              <Play className="size-3.5" /> {t("habits.card.resume")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => pauseHabit({ variables: { id: habit.id, date: todayIsoDate() } })}
            >
              <Pause className="size-3.5" /> {t("habits.card.pause")}
            </Button>
          )}
          {confirmingArchive ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingArchive(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => archiveHabit({ variables: { id: habit.id } })}
              >
                <Archive className="size-3.5" /> {t("habits.card.confirmArchive")}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmingArchive(true)}>
              <Archive className="size-3.5" /> {t("common.archive")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
