import { useTranslation } from "react-i18next";
import type { HeatmapDay } from "#graphql/types";
import { formatShortDate } from "#lib/dates";
import { cn } from "#lib/utils";

function cellClass(day: HeatmapDay | undefined): string {
  if (!day) return "bg-transparent";
  if (day.completed) return "bg-emerald-500 dark:bg-emerald-500";
  if (day.value != null) return "bg-emerald-300 dark:bg-emerald-800";
  return "bg-muted";
}

/**
 * GitHub-contribution-style grid: `days` is chronological (oldest first,
 * one entry per day — see graphql/habits/habits.resolvers.ts's `heatmap`
 * field), reshaped here into Sunday-aligned week columns of 7 day-rows.
 */
const SIZES = {
  /** The dashboard card's compact grid. */
  sm: { gap: "gap-[3px]", cell: "size-[10px] rounded-[2px]" },
  /** The habit detail page, where it has room to be read. */
  lg: { gap: "gap-1", cell: "size-5 rounded-[4px]" },
};

export function HeatmapGrid({
  days,
  size = "sm",
}: { days: HeatmapDay[]; size?: keyof typeof SIZES }) {
  const { gap, cell } = SIZES[size];
  const { t } = useTranslation();
  if (days.length === 0) return null;

  const leadingBlanks = new Date(days[0].date).getDay();
  const cells: (HeatmapDay | undefined)[] = [...Array(leadingBlanks).fill(undefined), ...days];
  const weeks: (HeatmapDay | undefined)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

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
              title={
                day
                  ? day.completed
                    ? t("habits.card.doneOn", { date: formatShortDate(day.date) })
                    : formatShortDate(day.date)
                  : undefined
              }
              className={cn(cell, cellClass(day))}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
