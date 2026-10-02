import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { HeatmapDay } from "#graphql/types";
import { formatLongDate, formatWeekday, fromIsoDate, todayIsoDate } from "#lib/dates";
import { cn } from "#lib/utils";
import { compareWeeks } from "#lib/week-comparison";

const HEIGHT = 180;
// Right padding leaves room for the line labels after each line's end.
const PAD = { top: 12, right: 76, bottom: 26, left: 28 };

/** The element's content width, kept current as it resizes. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * This week against last week: check-ins so far, Monday to Sunday. This week
 * is the emphasised line and stops at today; last week is the grey dashed
 * baseline. Both lines are labelled at their ends, and hovering (or focusing)
 * a day shows both counts.
 */
export function WeekComparisonChart({ days }: { days: HeatmapDay[] }) {
  const { t } = useTranslation();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const today = todayIsoDate();
  const { points, thisTotal, lastSoFar, lastTotal, todayIndex } = compareWeeks(days, today);

  const diff = thisTotal - lastSoFar;
  const max = Math.max(1, lastTotal, thisTotal);
  const ticks = Array.from({ length: max + 1 }, (_, i) => i).filter(
    (n) => max <= 4 || n % 2 === 0 || n === max,
  );

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (plotW * index) / 6;
  const y = (count: number) => PAD.top + plotH - (plotH * count) / max;
  const path = (values: (number | null)[]) =>
    values
      .map((value, i) => (value === null ? null : `${i === 0 ? "M" : "L"}${x(i)},${y(value)}`))
      .filter(Boolean)
      .join(" ");

  const thisValues = points.map((p) => p.thisWeek);
  const lastValues = points.map((p) => p.lastWeek);
  const hovered = active === null ? null : points[active];

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs text-muted-foreground">{t("habits.detail.weekTitle")}</h3>
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{thisTotal}</span>{" "}
          {t("habits.detail.weekThis", { count: thisTotal })}
          <span className="text-muted-foreground">
            {" · "}
            <span
              className={cn(
                "font-semibold tabular-nums",
                diff > 0 && "text-emerald-700 dark:text-emerald-400",
              )}
            >
              {diff > 0 ? `+${diff}` : diff < 0 ? `−${Math.abs(diff)}` : "±0"}
            </span>{" "}
            {t("habits.detail.weekVsLast", { day: formatWeekday(fromIsoDate(today), "long") })}
          </span>
        </p>
      </div>

      <div ref={ref} className="relative" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-labelledby="week-chart-desc">
            <desc id="week-chart-desc">
              {t("habits.detail.weekDesc", {
                thisCount: thisTotal,
                lastCount: lastSoFar,
                lastTotal,
              })}
            </desc>

            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  className="stroke-border"
                  strokeDasharray={tick === 0 ? undefined : "2 4"}
                />
                <text
                  x={PAD.left - 8}
                  y={y(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[10px] tabular-nums"
                >
                  {tick}
                </text>
              </g>
            ))}

            {points.map((p) => (
              <text
                key={p.index}
                x={x(p.index)}
                y={HEIGHT - 8}
                textAnchor="middle"
                className={cn(
                  "text-[10px]",
                  p.index === todayIndex
                    ? "fill-foreground font-semibold"
                    : "fill-muted-foreground",
                )}
              >
                {formatWeekday(fromIsoDate(p.thisDate))}
              </text>
            ))}

            {hovered && (
              <line
                x1={x(hovered.index)}
                x2={x(hovered.index)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                className="stroke-muted-foreground/50"
              />
            )}

            <path
              d={path(lastValues)}
              fill="none"
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinejoin="round"
              className="stroke-muted-foreground/70"
            />
            <path
              d={path(thisValues)}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              className="stroke-emerald-600 dark:stroke-emerald-500"
            />

            {points.map((p) => (
              <g key={p.index}>
                <circle
                  cx={x(p.index)}
                  cy={y(p.lastWeek)}
                  r={active === p.index ? 4.5 : 3}
                  className="fill-card stroke-muted-foreground/70"
                  strokeWidth={2}
                />
                {p.thisWeek !== null && (
                  <circle
                    cx={x(p.index)}
                    cy={y(p.thisWeek)}
                    r={active === p.index || p.index === todayIndex ? 5 : 4}
                    className="fill-emerald-600 stroke-card dark:fill-emerald-500"
                    strokeWidth={2}
                  />
                )}
              </g>
            ))}

            {/* Direct labels: last week after its end, this week beside today. */}
            <text
              x={x(6) + 10}
              y={y(lastTotal)}
              dominantBaseline="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {t("habits.detail.weekLastLabel")}
            </text>
            <text
              x={x(todayIndex) + 10}
              y={
                // Right of today's point, where the line has nothing yet; nudged
                // up only when last week's line passes through the same spot.
                y(thisTotal) - (thisTotal === points[todayIndex].lastWeek ? 12 : 0)
              }
              dominantBaseline="middle"
              className="fill-foreground text-[11px] font-medium"
            >
              {t("habits.detail.weekThisLabel")}
            </text>

            {/* Hit targets: a full-height column per day, wider than the marks. */}
            {points.map((p) => (
              <rect
                key={p.index}
                x={x(p.index) - plotW / 12}
                y={PAD.top}
                width={plotW / 6}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${formatWeekday(fromIsoDate(p.thisDate), "long")}: ${t(
                  "habits.detail.weekTooltipThis",
                  { count: p.thisWeek ?? 0 },
                )}, ${t("habits.detail.weekTooltipLast", { count: p.lastWeek })}`}
                onMouseEnter={() => setActive(p.index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(p.index)}
                onBlur={() => setActive(null)}
                className="outline-none"
              />
            ))}
          </svg>
        )}

        {hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-md border bg-popover px-3 py-2 text-xs shadow-md"
            style={{
              left: Math.min(Math.max(x(hovered.index) - 80, 0), Math.max(0, width - 160)),
            }}
          >
            <p className="mb-1 font-medium">{formatLongDate(fromIsoDate(hovered.thisDate))}</p>
            <p className="flex items-center gap-2">
              <span className="h-0.5 w-3 bg-emerald-600 dark:bg-emerald-500" />
              {hovered.thisWeek === null
                ? t("habits.detail.weekAhead")
                : t("habits.detail.weekTooltipThis", { count: hovered.thisWeek })}
            </p>
            <p className="flex items-center gap-2 text-muted-foreground">
              <span className="h-0 w-3 border-t-2 border-dashed border-muted-foreground/70" />
              {t("habits.detail.weekTooltipLast", { count: hovered.lastWeek })}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-emerald-600 dark:bg-emerald-500" />
          {t("habits.detail.weekThisLabel")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground/70" />
          {t("habits.detail.weekLastLabel")}
        </span>
      </div>
    </section>
  );
}
