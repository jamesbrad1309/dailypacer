import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { JournalDay } from "#graphql/types";
import { formatLongDate, fromIsoDate, todayIsoDate } from "#lib/dates";
import type { Lexicon } from "#lib/lexicon";
import { formatMood, moodScore } from "#lib/mood";
import { cn } from "#lib/utils";

interface Props {
  /** Every day of the month, "YYYY-MM-DD", in order. */
  days: string[];
  byDate: Map<string, JournalDay>;
  /** Optional, for feeling words outside the vocabulary (lib/lexicon.ts). */
  lexicon: Lexicon | null;
}

/** Plot height of one arm (above or below the zero line), in px. */
const ARM = 56;

/**
 * Diverging bars, one per day: up (teal) for a pleasant day, down (orange)
 * for an unpleasant one, length = how strongly. Direction carries the sign as
 * well as colour, so it reads without colour. Days with no feelings are gaps.
 */
export function MoodChart({ days, byDate, lexicon }: Props) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const [hovered, setHovered] = useState<string | null>(null);

  const points = days.map((date) => ({
    date,
    score: moodScore(byDate.get(date)?.feelings ?? [], lexicon),
  }));
  const hoveredPoint = points.find((p) => p.date === hovered);

  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{t("journal.mood.title")}</h3>
        <p className="h-4 text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {hoveredPoint &&
            `${formatLongDate(fromIsoDate(hoveredPoint.date))} · ${
              hoveredPoint.score === null
                ? t("journal.mood.noFeelings")
                : t("journal.mood.dayScore", { score: formatMood(hoveredPoint.score) })
            }`}
        </p>
      </div>

      <div className="flex gap-2">
        <div
          className="flex flex-col justify-between text-right text-[10px] text-muted-foreground"
          style={{ height: ARM * 2 }}
          aria-hidden
        >
          <span>+1</span>
          <span>0</span>
          <span>−1</span>
        </div>

        <div className="relative flex flex-1 gap-[2px]" style={{ height: ARM * 2 }}>
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-border" />
          {points.map(({ date, score }) => {
            const label = `${formatLongDate(fromIsoDate(date))}: ${
              score === null
                ? t("journal.mood.noFeelings")
                : t("journal.mood.dayScore", { score: formatMood(score) })
            }`;
            const cellClass = cn(
              "flex min-w-0 flex-1 flex-col rounded-sm transition-colors",
              hovered === date && "bg-accent",
            );
            return date > today ? (
              <span key={date} className={cellClass} aria-hidden />
            ) : (
              <Link
                key={date}
                to="/journal"
                search={date === today ? {} : { date }}
                aria-label={label}
                className={cellClass}
                onMouseEnter={() => setHovered(date)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(date)}
                onBlur={() => setHovered(null)}
              >
                <MoodBar score={score} />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 pl-5 text-[10px] text-muted-foreground tabular-nums" aria-hidden>
        <div className="flex flex-1 gap-[2px]">
          {days.map((date) => {
            const n = fromIsoDate(date).getDate();
            return (
              <span key={date} className="flex-1 text-center">
                {n === 1 || n % 5 === 0 ? n : ""}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MoodBar({ score }: { score: number | null }) {
  const length = score === null ? 0 : Math.max(2, Math.abs(score) * ARM);
  return (
    <>
      <span className="flex h-1/2 items-end">
        {score !== null && score > 0 && (
          <span className="w-full rounded-t-[4px] bg-teal-600" style={{ height: length }} />
        )}
      </span>
      <span className="flex h-1/2 items-start">
        {score !== null && score < 0 && (
          <span className="w-full rounded-b-[4px] bg-orange-600" style={{ height: length }} />
        )}
        {score === 0 && <span className="h-[2px] w-full bg-muted-foreground/60" />}
      </span>
    </>
  );
}
