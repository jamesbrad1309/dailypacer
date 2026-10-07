import { ChartColumn, Table2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";
import { useStoredState } from "#hooks/useStoredState";
import { cn } from "#lib/utils";

/**
 * Chart primitives for the Progress page, drawn with HTML and CSS like the
 * cash-flow chart: thin columns rounded at the data end, a recessive grid,
 * a tooltip per column (focusable, so the keyboard gets it too), and a
 * table view of the same numbers.
 */

/** A round number at or above `max` for the top gridline: 7 → 8, 23 → 25. */
export function niceCeil(max: number): number {
  if (max <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= max) return m * step;
  return 10 * step;
}

/** Every nth label, so a 26-week axis doesn't crowd. */
function labelEvery(count: number): number {
  return count > 16 ? 4 : count > 8 ? 2 : 1;
}

export interface ChartCardProps {
  /** Remembers the chart/table choice per chart. */
  id: string;
  title: string;
  subtitle?: string;
  /** Legend items: a swatch class and a label (shown for 2+ series). */
  legend?: { className: string; label: string }[];
  /** A headline under the title: the number that matters. */
  summary?: ReactNode;
  table: ReactNode;
  children: ReactNode;
}

export function ChartCard({
  id,
  title,
  subtitle,
  legend,
  summary,
  table,
  children,
}: ChartCardProps) {
  const { t } = useTranslation();
  const [asTable, setAsTable] = useStoredState(`lifeos.progress.${id}.table`, false);
  return (
    <section
      className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5"
      aria-label={title}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {legend && legend.length > 1 && !asTable && (
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {legend.map((item) => (
                <li key={item.label} className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-sm", item.className)} />
                  {item.label}
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={asTable}
            onClick={() => setAsTable(!asTable)}
          >
            {asTable ? <ChartColumn className="size-3.5" /> : <Table2 className="size-3.5" />}
            {asTable ? t("progress.chart") : t("progress.table")}
          </Button>
        </div>
      </div>
      {summary && <div className="text-sm">{summary}</div>}
      {asTable ? <div className="overflow-x-auto">{table}</div> : children}
    </section>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-muted-foreground">
        <tr className="border-b">
          {head.map((h, i) => (
            <th key={h} className={cn("py-2 font-medium", i === 0 ? "pr-3" : "px-3 text-right")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => (
          <tr key={String(row[0])}>
            {row.map((cell, i) => (
              <td
                key={head[i]}
                className={cn("py-1.5 tabular-nums", i === 0 ? "pr-3" : "px-3 text-right")}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Recessive gridlines at 0, ½ and the top, labelled on the left. */
function Grid({
  top,
  format,
  height,
}: {
  top: number;
  format: (v: number) => string;
  height: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height }} aria-hidden>
      {[1, 0.5, 0].map((f) => (
        <div
          key={f}
          className={cn(
            "absolute inset-x-0 border-t",
            f === 0 ? "border-foreground/30" : "border-dashed border-border",
          )}
          style={{ top: `${(1 - f) * 100}%` }}
        >
          {f > 0 && (
            <span className="absolute -top-2 left-0 bg-card pr-1 text-[0.65rem] text-muted-foreground tabular-nums">
              {format(top * f)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function Tooltip({
  title,
  rows,
  alignRight,
}: {
  title: string;
  rows: { label: ReactNode; value: string }[];
  alignRight: boolean;
}) {
  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute bottom-full z-10 mb-1 w-48 rounded-lg border bg-card p-3 text-xs text-card-foreground shadow-md",
        alignRight ? "right-0" : "left-0",
      )}
    >
      <p className="mb-1.5 font-medium">{title}</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-muted-foreground">
        {rows.map((row, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows of one tooltip, never reordered
          <div key={i} className="contents">
            <dt className="flex min-w-0 items-center gap-1.5">{row.label}</dt>
            <dd className="text-right text-foreground tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export interface Series {
  key: string;
  label: string;
  /** Background class: a `bg-viz-series-n` slot, or a neutral for "Other". */
  className: string;
}

export interface StackedColumn {
  key: string;
  /** Axis label ("5 Oct"); `title` is the tooltip's. */
  label: string;
  title: string;
  /** Values by series key. */
  values: Record<string, number>;
  /** Marks the current, unfinished week. */
  partial?: boolean;
}

const HEIGHT = 160;

/**
 * Columns stacked by series, bottom to top in series order, with a 2px
 * surface gap between segments so neighbouring colours never touch.
 */
export function StackedColumns({
  columns,
  series,
  ariaLabel,
  totalLabel,
}: {
  columns: StackedColumn[];
  series: Series[];
  ariaLabel: (column: StackedColumn, total: number) => string;
  totalLabel: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const totals = columns.map((c) => series.reduce((s, x) => s + (c.values[x.key] ?? 0), 0));
  const top = niceCeil(Math.max(...totals, 1));
  const every = labelEvery(columns.length);
  return (
    <div className="relative">
      <Grid top={top} format={(v) => String(Math.round(v))} height={HEIGHT} />
      <ol
        className="relative grid gap-0.5 pl-8 sm:gap-1"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column, i) => {
          const total = totals[i];
          return (
            <li
              key={column.key}
              className="relative"
              onMouseEnter={() => setHovered(column.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <button
                type="button"
                aria-label={ariaLabel(column, total)}
                onFocus={() => setHovered(column.key)}
                onBlur={() => setHovered(null)}
                className={cn(
                  "flex w-full flex-col rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hovered === column.key && "bg-accent/50",
                )}
              >
                <span
                  className="flex flex-col justify-end px-0.5"
                  style={{ height: HEIGHT }}
                  aria-hidden
                >
                  <span
                    className={cn(
                      "mx-auto flex w-full max-w-5 flex-col-reverse gap-[2px]",
                      column.partial && "opacity-70",
                    )}
                    style={{ height: `${(total / top) * 100}%` }}
                  >
                    {series.map((s, si) => {
                      const value = column.values[s.key] ?? 0;
                      if (value === 0) return null;
                      const isTop = series.slice(si + 1).every((x) => !(column.values[x.key] ?? 0));
                      return (
                        <span
                          key={s.key}
                          className={cn(
                            "min-h-[2px] w-full",
                            s.className,
                            isTop && "rounded-t-[4px]",
                          )}
                          style={{ flexGrow: value, flexBasis: 0 }}
                        />
                      );
                    })}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 h-4 truncate text-center text-[0.65rem] text-muted-foreground",
                    i % every !== (columns.length - 1) % every && "invisible",
                  )}
                >
                  {column.label}
                </span>
              </button>
              {hovered === column.key && (
                <Tooltip
                  title={column.title}
                  alignRight={i > columns.length / 2}
                  rows={[
                    ...series
                      .filter((s) => (column.values[s.key] ?? 0) > 0)
                      .reverse()
                      .map((s) => ({
                        label: (
                          <>
                            <span className={cn("size-2 shrink-0 rounded-sm", s.className)} />
                            <span className="truncate">{s.label}</span>
                          </>
                        ),
                        value: String(column.values[s.key]),
                      })),
                    { label: totalLabel, value: String(total) },
                  ]}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export interface RatePoint {
  key: string;
  label: string;
  title: string;
  /** 0–1, or null when nothing was due. */
  value: number | null;
  detail: string;
  partial?: boolean;
}

/**
 * A single series of rates (0–100%) as a line with points: no legend (the
 * title names it), a crosshair and tooltip per point, and an optional
 * dashed reference line (the previous period's rate).
 */
export function RateLine({
  points,
  reference,
  referenceLabel,
}: {
  points: RatePoint[];
  reference?: number | null;
  referenceLabel?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const x = (i: number) => ((i + 0.5) / points.length) * 100;
  const y = (v: number) => (1 - v) * HEIGHT;
  const segments: string[][] = [];
  let run: string[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (run.length) segments.push(run);
      run = [];
    } else run.push(`${x(i)},${y(p.value)}`);
  });
  if (run.length) segments.push(run);
  const every = labelEvery(points.length);
  return (
    <div className="relative pl-10">
      <Grid top={1} format={(v) => `${Math.round(v * 100)}%`} height={HEIGHT} />
      <div className="relative" style={{ height: HEIGHT }}>
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 100 ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {reference != null && (
            <line
              x1={0}
              x2={100}
              y1={y(reference)}
              y2={y(reference)}
              className="stroke-viz-reference"
              strokeWidth={1}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {hovered !== null && (
            <line
              x1={x(hovered)}
              x2={x(hovered)}
              y1={0}
              y2={HEIGHT}
              className="stroke-viz-reference"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {segments.map((seg) => (
            <polyline
              key={seg[0]}
              points={seg.join(" ")}
              fill="none"
              className="stroke-viz-series-1"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {points.map((p, i) =>
          p.value === null ? null : (
            <span
              key={p.key}
              aria-hidden
              className={cn(
                "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
                p.partial ? "border-2 border-viz-series-1 bg-card" : "bg-viz-series-1",
                hovered === i && "size-3",
              )}
              style={{ left: `${x(i)}%`, top: y(p.value) }}
            />
          ),
        )}
        {reference != null && referenceLabel && (
          <span
            className="absolute right-0 -translate-y-full bg-card px-1 text-[0.65rem] text-muted-foreground"
            style={{ top: y(reference) }}
          >
            {referenceLabel}
          </span>
        )}
        <ol
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
        >
          {points.map((p, i) => (
            <li key={p.key} className="relative">
              <button
                type="button"
                aria-label={`${p.title}: ${p.value === null ? "—" : `${Math.round(p.value * 100)}%`}, ${p.detail}`}
                className="h-full w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
              />
              {hovered === i && (
                <Tooltip
                  title={p.title}
                  alignRight={i > points.length / 2}
                  rows={[
                    {
                      label: p.detail,
                      value: p.value === null ? "—" : `${Math.round(p.value * 100)}%`,
                    },
                  ]}
                />
              )}
            </li>
          ))}
        </ol>
      </div>
      <ol
        className="mt-1 grid"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {points.map((p, i) => (
          <li
            key={p.key}
            className={cn(
              "truncate text-center text-[0.65rem] text-muted-foreground",
              i % every !== (points.length - 1) % every && "invisible",
            )}
          >
            {p.label}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Mood per column around a zero baseline: up and teal for pleasant weeks,
 * down and orange for unpleasant ones (the journal's mood colours), with
 * the value in the tooltip and table.
 */
export function DivergingColumns({
  points,
}: {
  points: { key: string; label: string; title: string; value: number | null; detail: string }[];
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const half = 70;
  const every = labelEvery(points.length);
  return (
    <div className="relative pl-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{ height: half * 2 }}
        aria-hidden
      >
        {[1, 0, -1].map((v) => (
          <div
            key={v}
            className={cn(
              "absolute inset-x-0 border-t",
              v === 0 ? "border-foreground/30" : "border-dashed border-border",
            )}
            style={{ top: (1 - v) * half }}
          >
            <span className="absolute -top-2 left-0 bg-card pr-1 text-[0.65rem] text-muted-foreground tabular-nums">
              {v > 0 ? "+1" : v < 0 ? "−1" : "0"}
            </span>
          </div>
        ))}
      </div>
      <ol
        className="relative grid gap-0.5 sm:gap-1"
        style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
      >
        {points.map((p, i) => {
          const v = p.value ?? 0;
          return (
            <li
              key={p.key}
              className="relative"
              onMouseEnter={() => setHovered(p.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <button
                type="button"
                aria-label={`${p.title}: ${p.detail}`}
                onFocus={() => setHovered(p.key)}
                onBlur={() => setHovered(null)}
                className={cn(
                  "flex w-full flex-col rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hovered === p.key && "bg-accent/50",
                )}
              >
                <span className="relative block" style={{ height: half * 2 }} aria-hidden>
                  {p.value !== null && (
                    <span
                      className={cn(
                        "absolute left-1/2 w-full max-w-4 -translate-x-1/2",
                        v >= 0
                          ? "rounded-t-[4px] bg-teal-600/80"
                          : "rounded-b-[4px] bg-orange-600/80",
                      )}
                      style={
                        v >= 0
                          ? { bottom: half, height: Math.max(2, v * half) }
                          : { top: half, height: Math.max(2, -v * half) }
                      }
                    />
                  )}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 h-4 truncate text-center text-[0.65rem] text-muted-foreground",
                    i % every !== (points.length - 1) % every && "invisible",
                  )}
                >
                  {p.label}
                </span>
              </button>
              {hovered === p.key && (
                <Tooltip
                  title={p.title}
                  alignRight={i > points.length / 2}
                  rows={[{ label: p.detail, value: "" }]}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Horizontal bars of a rate per row, best first, the value written beside each. */
export function RankedBars({
  rows,
}: {
  rows: { key: string; label: string; value: number | null; detail: string }[];
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 tabular-nums">
              {row.value === null ? "—" : `${Math.round(row.value * 100)}%`}
              <span className="ml-2 text-xs text-muted-foreground">{row.detail}</span>
            </span>
          </span>
          <span className="h-1.5 rounded-full bg-muted" aria-hidden>
            <span
              className="block h-full rounded-full bg-viz-series-1"
              style={{ width: `${Math.max(1, (row.value ?? 0) * 100)}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
