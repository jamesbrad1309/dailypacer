import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MoodChart } from "#components/journal/MoodChart";
import { Button } from "#components/ui/button";
import { JOURNAL_DAYS_QUERY, JOURNAL_FIRST_DATE_QUERY } from "#graphql/journal";
import type { JournalDay, JournalDaysData } from "#graphql/types";
import { useLexicon } from "#hooks/useLexicon";
import {
  addDays,
  addMonths,
  currentMonth,
  daysBetween,
  formatLongDate,
  formatMonth,
  formatWeekday,
  fromIsoDate,
  monthGridRange,
  todayIsoDate,
} from "#lib/dates";
import { dominantEmotion } from "#lib/emotions";
import { KINDS } from "#lib/journal-kinds";
import { averageMood, formatMood, type MoodBand, moodBand, moodScore } from "#lib/mood";
import { cn } from "#lib/utils";

/** Day-cell tint: teal for a pleasant day, orange for an unpleasant one, stronger the further from 0. */
function moodTint(score: number | null): string | null {
  if (score === null) return null;
  const strong = Math.abs(score) > 0.6;
  switch (moodBand(score)) {
    case "good":
      return strong ? "bg-teal-600/30 hover:bg-teal-600/40" : "bg-teal-600/15 hover:bg-teal-600/25";
    case "low":
      return strong
        ? "bg-orange-600/30 hover:bg-orange-600/40"
        : "bg-orange-600/15 hover:bg-orange-600/25";
    default:
      return "bg-muted hover:bg-accent";
  }
}

const BAND_INK: Record<MoodBand, string> = {
  good: "text-teal-700 dark:text-teal-400",
  mixed: "text-foreground",
  low: "text-orange-700 dark:text-orange-400",
};

function entryCount(day: JournalDay | undefined): number {
  return day ? day.actionCount + day.feelingCount + day.eventCount : 0;
}

interface Props {
  /** "YYYY-MM", never after this month. It lives in the URL, owned by the route. */
  month: string;
  onMonthChange: (month: string) => void;
}

/**
 * A month of journal days. Written days show their dominant feeling, a dot
 * per kind, and are tinted by their mood score (see lib/mood.ts); past days with nothing written (since the first entry) are
 * marked as missed, so gaps are easy to spot. Every day links to that day in the journal.
 */
export function JournalCalendar({ month, onMonthChange }: Props) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const thisMonth = currentMonth();
  const lexicon = useLexicon();
  const { from, to } = monthGridRange(month);
  const days = Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i));
  const weekdays = days.slice(0, 7).map((date) => formatWeekday(fromIsoDate(date)));

  const { data, loading, error } = useQuery<JournalDaysData>(JOURNAL_DAYS_QUERY, {
    variables: { from, to },
  });
  const byDate = new Map((data?.journalDays ?? []).map((day) => [day.date, day]));
  const { data: firstData } = useQuery<{ journalFirstDate: string | null }>(
    JOURNAL_FIRST_DATE_QUERY,
  );
  const firstDate = firstData?.journalFirstDate ?? null;

  // The tally only counts days from the first entry ever written up to today;
  // earlier days weren't skipped, and today isn't "missed" until it's over.
  const monthDays = firstDate
    ? days.filter((date) => date.startsWith(month) && date >= firstDate && date <= today)
    : [];
  const written = monthDays.filter((date) => entryCount(byDate.get(date)) > 0).length;
  const missed = monthDays.filter((date) => date < today && !entryCount(byDate.get(date))).length;
  const inMonthDays = days.filter((date) => date.startsWith(month));
  const average = averageMood(
    inMonthDays.map((date) => byDate.get(date)).filter((day) => day !== undefined),
    lexicon,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.previousMonth")}
            onClick={() => onMonthChange(addMonths(month, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="min-w-32 text-center text-lg font-semibold">{formatMonth(month)}</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common.nextMonth")}
            disabled={month >= thisMonth}
            onClick={() => onMonthChange(addMonths(month, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
          {month !== thisMonth && (
            <Button variant="outline" size="sm" onClick={() => onMonthChange(thisMonth)}>
              {t("journal.calendar.thisMonth")}
            </Button>
          )}
        </div>

        {data && monthDays.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{written}</span>{" "}
            {t("journal.calendar.written", { count: monthDays.length })}
            {missed > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-foreground tabular-nums">{missed}</span>{" "}
                {t("journal.calendar.missed", { count: missed })}
              </>
            )}
            {average !== null && (
              <>
                {" · "}
                {t("journal.mood.average")}{" "}
                <span className={cn("font-semibold tabular-nums", BAND_INK[moodBand(average)])}>
                  {formatMood(average)}
                </span>{" "}
                ({t(`journal.mood.bands.${moodBand(average)}`)})
              </>
            )}
          </p>
        )}
      </div>

      {error && <p className="text-destructive">{error.message}</p>}

      <div className="grid grid-cols-7 gap-1.5" aria-busy={loading}>
        {weekdays.map((name) => (
          <div key={name} className="pb-1 text-center text-xs font-medium text-muted-foreground">
            {name}
          </div>
        ))}

        {days.map((date) => {
          const summary = byDate.get(date);
          const count = entryCount(summary);
          const inMonth = date.startsWith(month);
          const isFuture = date > today;
          const isMissed =
            inMonth && !!firstDate && date >= firstDate && date < today && count === 0 && !loading;
          const score = moodScore(summary?.feelings ?? [], lexicon);
          const tint = moodTint(score);
          const detail =
            count > 0
              ? [
                  t("journal.calendar.entries", { count }),
                  score !== null && t("journal.mood.dayScore", { score: formatMood(score) }),
                ]
                  .filter(Boolean)
                  .join(", ")
              : isMissed
                ? t("journal.calendar.nothingWritten")
                : null;
          const label = [formatLongDate(fromIsoDate(date)), detail].filter(Boolean).join(": ");

          const cellClass = cn(
            "flex min-h-20 flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors sm:min-h-24",
            !inMonth && "opacity-40",
            count > 0 && cn("border-border", tint ?? "bg-card hover:bg-accent"),
            isMissed && "border-dashed border-muted-foreground/40 hover:bg-accent",
            !count && !isMissed && "border-transparent hover:bg-accent",
          );

          return isFuture ? (
            <div key={date} className={cn(cellClass, "opacity-30")} aria-hidden>
              <span className="text-sm tabular-nums">{fromIsoDate(date).getDate()}</span>
            </div>
          ) : (
            <Link
              key={date}
              to="/journal"
              search={date === today ? {} : { date }}
              aria-label={label}
              title={label}
              className={cellClass}
            >
              <DayContent date={date} today={today} summary={summary} score={score} />
            </Link>
          );
        })}
      </div>

      <MoodChart days={inMonthDays} byDate={byDate} lexicon={lexicon} />

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {KINDS.map(({ kind, dotClass }) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", dotClass)} />
            {t(`journal.kinds.${kind}.label`)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-dashed border-muted-foreground/40" />
          {t("journal.calendar.legendMissed")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-teal-600/30" />
          {t("journal.mood.pleasant")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-orange-600/30" />
          {t("journal.mood.unpleasant")}
        </span>
      </div>
    </div>
  );
}

function DayContent({
  date,
  today,
  summary,
  score,
}: {
  date: string;
  today: string;
  summary: JournalDay | undefined;
  score: number | null;
}) {
  return (
    <>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          date === today &&
            "flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground",
        )}
      >
        {fromIsoDate(date).getDate()}
      </span>
      <span className="flex h-6 items-center text-lg leading-none" aria-hidden>
        {dominantEmotion(summary) ?? ""}
      </span>
      <span className="flex h-1.5 gap-0.5" aria-hidden>
        {KINDS.map(({ kind, dotClass }) => {
          const kindCount =
            kind === "ACTION"
              ? summary?.actionCount
              : kind === "FEELING"
                ? summary?.feelingCount
                : summary?.eventCount;
          return kindCount ? (
            <span key={kind} className={cn("size-1.5 rounded-full", dotClass)} />
          ) : null;
        })}
      </span>
      {score !== null && (
        <span className="text-[10px] font-medium text-muted-foreground tabular-nums" aria-hidden>
          {formatMood(score)}
        </span>
      )}
    </>
  );
}
