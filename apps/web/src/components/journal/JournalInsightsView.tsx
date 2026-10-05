import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HeatmapGrid } from "#components/HeatmapGrid";
import { ListSkeleton } from "#components/layout/Skeletons";
import { Card, CardContent } from "#components/ui/card";
import { JOURNAL_FEELINGS_QUERY, JOURNAL_RANGE_QUERY } from "#graphql/journal";
import type { HeatmapDay, JournalEntry, JournalFeeling } from "#graphql/types";
import { useLexicon } from "#hooks/useLexicon";
import { useSyntaxLanguage } from "#hooks/useSyntaxLanguage";
import { addDays, todayIsoDate } from "#lib/dates";
import { emotionFor } from "#lib/emotions";
import { moodByDay, moodStreak, triggerPatterns } from "#lib/habit-mood";
import { emotionName } from "#lib/journal-syntax";
import { capitalizeFirst } from "#lib/utils";

/** Days the mood heatmap shows, as a habit's does. */
const HEATMAP_DAYS = 120;
/** How far back patterns look. */
const PATTERN_DAYS = 180;

const percent = (share: number) => `${Math.round(share * 100)}%`;

/**
 * Patterns in the journal: the mood check-in streak (days in a row with a
 * feeling logged) with a 120-day heatmap tinted by each day's mood, and
 * which kinds of events (by #tag) the feelings linked to them tend to be.
 */
export function JournalInsightsView() {
  const { t } = useTranslation();
  const language = useSyntaxLanguage();
  const lexicon = useLexicon();
  const today = todayIsoDate();
  const from = addDays(today, -(HEATMAP_DAYS - 1));
  const { data: feelingsData, loading } = useQuery<{ journalFeelings: JournalFeeling[] }>(
    JOURNAL_FEELINGS_QUERY,
    { variables: { from: addDays(today, -399), to: today } },
  );
  const { data: rangeData } = useQuery<{ journalRange: JournalEntry[] }>(JOURNAL_RANGE_QUERY, {
    variables: { from: addDays(today, -PATTERN_DAYS), to: today },
  });

  if (loading && !feelingsData) return <ListSkeleton rows={4} />;
  const feelings = feelingsData?.journalFeelings ?? [];
  const logged = new Set(feelings.map((f) => f.date));
  const streak = moodStreak(logged, today);
  const mood = moodByDay(feelings, lexicon);
  const days: HeatmapDay[] = Array.from({ length: HEATMAP_DAYS }, (_, i) => {
    const date = addDays(from, i);
    return {
      date,
      completed: logged.has(date),
      value: null,
      // The tint says it all; "OFF" keeps the habit heatmap's done-dot off.
      status: "OFF",
    };
  });
  const patterns = triggerPatterns(rangeData?.journalRange ?? []);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Flame className="size-4 text-amber-500" /> {t("journal.insights.streak")}
            </span>
            <span className="text-3xl font-semibold tabular-nums">
              {t("journal.insights.days", { count: streak.current })}
            </span>
            <span className="text-xs text-muted-foreground">
              {streak.loggedToday
                ? t("journal.insights.loggedToday")
                : streak.current > 0
                  ? t("journal.insights.logToKeep")
                  : t("journal.insights.logToStart")}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-sm text-muted-foreground">{t("journal.insights.best")}</span>
            <span className="text-3xl font-semibold tabular-nums">
              {t("journal.insights.days", { count: streak.best })}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-sm text-muted-foreground">{t("journal.insights.checkedIn")}</span>
            <span className="text-3xl font-semibold tabular-nums">
              {days.filter((d) => d.completed).length}
              <span className="text-base font-normal text-muted-foreground"> / {HEATMAP_DAYS}</span>
            </span>
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div>
          <h2 className="text-sm font-medium">
            {t("journal.insights.heatmapTitle", { count: HEATMAP_DAYS })}
          </h2>
          <p className="text-xs text-muted-foreground">{t("journal.insights.heatmapHint")}</p>
        </div>
        <div className="flex justify-center">
          <HeatmapGrid days={days} size="lg" mood={mood} />
        </div>
        <ul className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Key className="bg-teal-600/70" label={t("journal.mood.bands.good")} />
          <Key className="bg-muted-foreground/30" label={t("journal.mood.bands.mixed")} />
          <Key className="bg-orange-600/70" label={t("journal.mood.bands.low")} />
          <Key className="bg-muted/60" label={t("journal.insights.noFeelings")} />
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">{t("journal.insights.patternsTitle")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("journal.insights.patternsHint", { days: PATTERN_DAYS })}
          </p>
        </div>
        {patterns.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t("journal.insights.noPatterns")}
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {patterns.map((p) => {
              const emotion = emotionFor(p.top.emotion);
              return (
                <li
                  key={p.tag}
                  className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <Link
                      to="/journal/search"
                      search={{ tag: p.tag }}
                      className="font-medium text-sky-700 hover:underline dark:text-sky-400"
                    >
                      #{p.tag}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {t("journal.insights.counts", { events: p.events, feelings: p.feelings })}
                    </span>
                  </div>
                  <p>
                    {t("journal.insights.mostOften", {
                      emotion: `${emotion.emoji} ${capitalizeFirst(emotionName(emotion.name, language))}`,
                      share: percent(p.top.count / p.feelings),
                    })}
                  </p>
                  <div
                    className="flex h-2 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={t("journal.insights.mix", {
                      pleasant: percent(p.pleasant),
                      unpleasant: percent(p.unpleasant),
                    })}
                  >
                    <span
                      className="h-full bg-teal-600/70"
                      style={{ width: percent(p.pleasant) }}
                    />
                    <span className="h-full flex-1" />
                    <span
                      className="h-full bg-orange-600/70"
                      style={{ width: percent(p.unpleasant) }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("journal.insights.mix", {
                      pleasant: percent(p.pleasant),
                      unpleasant: percent(p.unpleasant),
                    })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`size-3 rounded-[2px] ${className}`} />
      {label}
    </li>
  );
}
