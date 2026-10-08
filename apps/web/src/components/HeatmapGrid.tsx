import { useTranslation } from "react-i18next";
import type { HabitDayStatus, HeatmapDay } from "#graphql/types";
import { withAlpha } from "#lib/colors";
import { formatShortDate } from "#lib/dates";
import { moodBand } from "#lib/mood";
import { cn } from "#lib/utils";

/** Fill per status. Frozen and slipped days also get a mark (see Cell), so colour isn't alone. */
const STATUS_CLASS: Partial<Record<HabitDayStatus, string>> = {
  DONE: "bg-emerald-500 dark:bg-emerald-500",
  PARTIAL: "bg-emerald-300 dark:bg-emerald-800",
  FROZEN: "bg-sky-400/70 dark:bg-sky-500/60",
  SLIPPED: "bg-orange-500/80 dark:bg-orange-500/70",
};

function cellClass(day: HeatmapDay | undefined): string {
  if (!day) return "bg-transparent";
  const byStatus = STATUS_CLASS[day.status];
  if (byStatus) return byStatus;
  if (day.completed) return STATUS_CLASS.DONE as string;
  if (day.value != null) return STATUS_CLASS.PARTIAL as string;
  return "bg-muted";
}

/** The habit's own colour for done and partly done days; the status classes stay as the fallback. */
function cellStyle(day: HeatmapDay, color: string | null | undefined) {
  if (!color) return undefined;
  if (day.status === "DONE" || (day.completed && !day.status)) return { backgroundColor: color };
  if (day.status === "PARTIAL") return { backgroundColor: withAlpha(color, 0.45) };
  return undefined;
}

/** A day's mood as a fill: teal pleasant, orange unpleasant, grey mixed (lib/mood.ts). */
function moodClass(score: number | undefined): string {
  if (score === undefined) return "bg-muted/60";
  switch (moodBand(score)) {
    case "good":
      return Math.abs(score) > 0.6 ? "bg-teal-600/70" : "bg-teal-600/40";
    case "low":
      return Math.abs(score) > 0.6 ? "bg-orange-600/70" : "bg-orange-600/40";
    default:
      return "bg-muted-foreground/30";
  }
}

/**
 * GitHub-contribution-style grid: `days` is chronological (oldest first,
 * one entry per day — see graphql/habits/habits.resolvers.ts's `heatmap`
 * field), reshaped here into Sunday-aligned week columns of 7 day-rows.
 */
const SIZES = {
  /** The dashboard card's compact grid. */
  sm: { gap: "gap-[3px]", cell: "size-[10px] rounded-[2px]", dot: "size-[4px]" },
  /** The habit detail page, where it has room to be read. */
  lg: { gap: "gap-1", cell: "size-5 rounded-[4px]", dot: "size-2" },
};

interface Props {
  days: HeatmapDay[];
  size?: keyof typeof SIZES;
  /**
   * Mood overlay: each day filled by that day's mood (day → −1…+1), and a
   * dot on the days the habit was done, to see the two together.
   */
  mood?: ReadonlyMap<string, number>;
  /** The habit's colour (a hex), used for done days instead of the default green. */
  color?: string | null;
}

export function HeatmapGrid({ days, size = "sm", mood, color }: Props) {
  const { gap, cell, dot } = SIZES[size];
  const { t } = useTranslation();
  if (days.length === 0) return null;

  const leadingBlanks = new Date(days[0].date).getDay();
  const cells: (HeatmapDay | undefined)[] = [...Array(leadingBlanks).fill(undefined), ...days];
  const weeks: (HeatmapDay | undefined)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const title = (day: HeatmapDay) => {
    const parts = [formatShortDate(day.date)];
    if (day.status === "DONE" || (day.completed && !day.status))
      parts.push(t("habits.heatmap.done"));
    else if (day.status === "FROZEN") parts.push(t("habits.heatmap.frozen"));
    else if (day.status === "SLIPPED") parts.push(t("habits.heatmap.slipped"));
    const score = mood?.get(day.date);
    if (mood && score !== undefined) parts.push(t(`journal.mood.bands.${moodBand(score)}`));
    return parts.join(" — ");
  };

  return (
    <div className={cn("flex overflow-x-auto py-1", gap)}>
      {weeks.map((week, weekIdx) => (
        <div
          key={week.find((d) => d)?.date ?? `week-${weekIdx}`}
          className={cn("flex flex-col", gap)}
        >
          {week.map((day, dayIdx) => (
            <div
              key={day?.date ?? `blank-${weekIdx}-${dayIdx}`}
              title={day ? title(day) : undefined}
              style={day && !mood ? cellStyle(day, color) : undefined}
              className={cn(
                cell,
                "flex items-center justify-center",
                day ? (mood ? moodClass(mood.get(day.date)) : cellClass(day)) : "bg-transparent",
              )}
            >
              {day && mood && day.status === "DONE" && (
                <span aria-hidden className={cn(dot, "rounded-full bg-foreground")} />
              )}
              {day && !mood && size === "lg" && day.status === "FROZEN" && (
                <span aria-hidden className="text-[10px] leading-none">
                  ❄
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
