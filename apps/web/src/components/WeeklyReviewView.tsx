import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronLeft, ChevronRight, Flame, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HabitCorrelations } from "#components/HabitCorrelations";
import { ListSkeleton } from "#components/layout/Skeletons";
import { Button } from "#components/ui/button";
import { Card, CardContent } from "#components/ui/card";
import { Progress } from "#components/ui/progress";
import {
  HABITS_QUERY,
  HABIT_CORRELATIONS_QUERY,
  HABIT_PAGE_FETCH,
  WEEKLY_REVIEW_QUERY,
} from "#graphql/habits";
import type { HabitCorrelation, HabitsData, ReviewTotals, WeeklyReview } from "#graphql/types";
import {
  addDays,
  formatShortDate,
  formatWeekday,
  fromIsoDate,
  startOfWeek,
  todayIsoDate,
} from "#lib/dates";
import { cn } from "#lib/utils";

const pct = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)}%`);

/**
 * A week of habits in one screen: done against due and against the week
 * before, the habits done every time, what was missed, streaks at risk
 * today, the best day, and patterns between habits. Defaults to the week
 * just finished on Sunday and Monday (when a review is most useful), this
 * week otherwise.
 */
export function WeeklyReviewView({
  weekStart,
  onWeekChange,
}: {
  weekStart?: string;
  onWeekChange: (weekStart: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const week = weekStart ?? defaultReviewWeek(today);
  const { data, loading, error } = useQuery<{ weeklyReview: WeeklyReview }>(WEEKLY_REVIEW_QUERY, {
    variables: { weekStart: week, today },
  });
  const { data: habitsData } = useQuery<HabitsData>(HABITS_QUERY, HABIT_PAGE_FETCH);
  const { data: correlationsData } = useQuery<{ habitCorrelations: HabitCorrelation[] }>(
    HABIT_CORRELATIONS_QUERY,
    { variables: { today } },
  );
  const review = data?.weeklyReview;
  const isCurrent = week === startOfWeek(today);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("habits.review.previous")}
          onClick={() => onWeekChange(addDays(week, -7))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-40 text-center text-sm font-medium">
          {t("habits.calendar.weekOf", {
            from: formatShortDate(week),
            to: formatShortDate(addDays(week, 6)),
          })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("habits.review.next")}
          disabled={isCurrent}
          onClick={() => onWeekChange(addDays(week, 7))}
        >
          <ChevronRight className="size-4" />
        </Button>
        {review && !review.complete && (
          <span className="text-xs text-muted-foreground">{t("habits.review.inProgress")}</span>
        )}
      </div>

      {error && <p className="text-destructive">{error.message}</p>}
      {loading && !review ? (
        <ListSkeleton rows={4} />
      ) : review && review.habits.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Summary totals={review.totals} previous={review.previous} />
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <p className="text-sm text-muted-foreground">{t("habits.review.bestDay")}</p>
                <p className="text-2xl font-semibold">
                  {review.bestDay ? formatWeekday(fromIsoDate(review.bestDay.date), "long") : "—"}
                </p>
                {review.bestDay && (
                  <p className="text-xs text-muted-foreground">
                    {t("habits.review.checkIns", { count: review.bestDay.done })}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Trophy className="size-4 text-amber-500" /> {t("habits.review.wins")}
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  {review.wins.length}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    / {review.habits.filter((h) => h.due > 0).length}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{t("habits.review.winsHint")}</p>
              </CardContent>
            </Card>
          </div>

          {review.atRisk.length > 0 && (
            <section
              aria-labelledby="at-risk"
              className="flex flex-col gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
            >
              <h3 id="at-risk" className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4 text-amber-700 dark:text-amber-400" />
                {t("habits.review.atRisk", { count: review.atRisk.length })}
              </h3>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 pl-6">
                {review.atRisk.map((habit) => (
                  <li key={habit.id} className="flex items-center gap-1">
                    <Flame className="size-3.5 text-amber-500" aria-hidden />
                    {t("habits.review.streakOf", { name: habit.name, count: habit.currentStreak })}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border bg-card">
            <h3 className="border-b px-4 py-2.5 text-sm font-medium">
              {t("habits.review.byHabit")}
            </h3>
            <ul className="divide-y">
              {review.habits
                .filter((h) => h.due > 0 || h.done > 0)
                .sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1))
                .map((habit) => (
                  <li key={habit.id} className="flex flex-col gap-1.5 px-4 py-2.5">
                    <div className="flex items-center gap-2 text-sm">
                      <Link
                        to="/habits/$habitId"
                        params={{ habitId: habit.id }}
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {habit.name}
                      </Link>
                      {review.wins.includes(habit.id) && (
                        <span className="flex items-center gap-1 text-xs text-status-good">
                          <Trophy className="size-3" aria-hidden /> {t("habits.review.everyTime")}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {habit.done}/{habit.due} · {pct(habit.rate)}
                      </span>
                    </div>
                    <Progress value={(habit.rate ?? 0) * 100} className="h-1.5" />
                    {(habit.missed.length > 0 || habit.frozen > 0) && (
                      <p className="text-xs text-muted-foreground">
                        {habit.missed.length > 0 &&
                          t("habits.review.missedOn", {
                            days: habit.missed.map((d) => formatWeekday(fromIsoDate(d))).join(", "),
                          })}
                        {habit.frozen > 0 &&
                          ` ${t("habits.review.frozen", { count: habit.frozen })}`}
                      </p>
                    )}
                  </li>
                ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <div>
              <h3 className="text-sm font-medium">{t("habits.correlations.title")}</h3>
              <p className="text-xs text-muted-foreground">{t("habits.correlations.hint")}</p>
            </div>
            <HabitCorrelations
              correlations={(correlationsData?.habitCorrelations ?? []).slice(0, 5)}
              habits={habitsData?.habits ?? []}
            />
          </section>
        </>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("habits.review.empty")}
        </p>
      )}
    </div>
  );
}

function Summary({ totals, previous }: { totals: ReviewTotals; previous: ReviewTotals }) {
  const { t } = useTranslation();
  const change =
    totals.rate !== null && previous.rate !== null
      ? Math.round((totals.rate - previous.rate) * 100)
      : null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <p className="text-sm text-muted-foreground">{t("habits.review.completion")}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {pct(totals.rate)}
          <span className="ml-2 text-base font-normal text-muted-foreground">
            {totals.done}/{totals.due}
          </span>
        </p>
        {change !== null && (
          <p
            className={cn(
              "text-xs",
              change > 0
                ? "text-status-good"
                : change < 0
                  ? "text-status-critical"
                  : "text-muted-foreground",
            )}
          >
            {change === 0
              ? t("habits.review.sameAsLast")
              : t(change > 0 ? "habits.review.up" : "habits.review.down", {
                  points: Math.abs(change),
                })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Sunday and Monday look back at the week just finished; other days at this week. */
function defaultReviewWeek(today: string): string {
  const weekday = fromIsoDate(today).getDay();
  const thisWeek = startOfWeek(today);
  return weekday === 0 ? thisWeek : weekday === 1 ? addDays(thisWeek, -7) : thisWeek;
}
