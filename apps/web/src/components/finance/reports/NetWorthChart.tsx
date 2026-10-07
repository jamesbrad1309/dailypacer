import { useQuery } from "@apollo/client/react";
import { ChartLine, Table2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { moneyToneClass } from "#components/finance/Amount";
import { UnconvertedNote } from "#components/finance/reports/UnconvertedNote";
import { Button } from "#components/ui/button";
import { Card, CardContent } from "#components/ui/card";
import { NET_WORTH_HISTORY_QUERY } from "#graphql/finance";
import type { NetWorthHistoryData, NetWorthMonth } from "#graphql/types";
import { useStoredState } from "#hooks/useStoredState";
import { getLocale } from "#i18n/locale";
import { formatMonth, fromIsoDate } from "#lib/dates";
import { formatMoney, formatMoneyShort } from "#lib/money";
import { cn } from "#lib/utils";

const MONTHS = 12;
const HEIGHT = 160;

function shortMonth(month: string): string {
  return fromIsoDate(`${month}-01`).toLocaleDateString(getLocale(), { month: "short" });
}

/** Round gridline bounds around the data, always including zero. */
function niceRange(values: number[]): { min: number; max: number } {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const step = 10 ** Math.floor(Math.log10(span));
  const round = (v: number, up: boolean) => {
    for (const m of [1, 2, 2.5, 5, 10]) {
      const s = (m * step) / 2;
      const r = up ? Math.ceil(v / s) * s : Math.floor(v / s) * s;
      if (Math.abs(r - v) <= s) return r;
    }
    return up ? Math.ceil(v / step) * step : Math.floor(v / step) * step;
  };
  // All zero or below: zero is the top line; all zero: give the axis a height.
  const top = hi > 0 ? round(hi, true) : lo < 0 ? 0 : 1;
  return { min: lo < 0 ? round(lo, false) : 0, max: top };
}

const signed = (minor: number, currency: string) =>
  `${minor > 0 ? "+" : minor < 0 ? "−" : ""}${formatMoney(Math.abs(minor), currency)}`;

/**
 * Net worth at the end of each of the 12 months up to `month`: one line
 * (a single series, named by the title, so no legend), a crosshair and
 * tooltip per month, and the same figures as a table.
 */
export function NetWorthChart({ month }: { month: string }) {
  const { t } = useTranslation();
  const { data, error } = useQuery<NetWorthHistoryData>(NET_WORTH_HISTORY_QUERY, {
    variables: { to: month, months: MONTHS },
  });
  const [asTable, setAsTable] = useStoredState("dailypacer.netWorth.asTable", false);
  const report = data?.netWorthHistory;

  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!report) return null;
  const { currency, months } = report;
  const hasData = months.some((m) => m.assetsMinor !== 0 || m.liabilitiesMinor !== 0);
  const first = months.find((m) => m.assetsMinor !== 0 || m.liabilitiesMinor !== 0);
  const last = months[months.length - 1];

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">{t("finance.reports.netWorth.title")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("finance.reports.netWorth.subtitle", { month: formatMonth(month) })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={asTable}
            onClick={() => setAsTable(!asTable)}
          >
            {asTable ? <ChartLine className="size-3.5" /> : <Table2 className="size-3.5" />}
            {asTable ? t("finance.spending.chart") : t("finance.spending.table")}
          </Button>
        </div>

        {!hasData ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("finance.reports.netWorth.empty")}
          </p>
        ) : (
          <>
            <p className="text-sm">
              <span className="text-2xl font-semibold tracking-tight tabular-nums">
                {formatMoney(last.netWorthMinor, currency)}
              </span>
              {first && first.month !== last.month && (
                <span
                  className={cn("ml-2", moneyToneClass(last.netWorthMinor - first.netWorthMinor))}
                >
                  {t("finance.reports.netWorth.change", {
                    amount: signed(last.netWorthMinor - first.netWorthMinor, currency),
                    month: formatMonth(first.month),
                  })}
                </span>
              )}
            </p>
            {asTable ? (
              <NetWorthTable months={months} currency={currency} />
            ) : (
              <Line months={months} currency={currency} />
            )}
          </>
        )}
        <UnconvertedNote codes={report.unconverted} />
      </CardContent>
    </Card>
  );
}

function Line({ months, currency }: { months: NetWorthMonth[]; currency: string }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<number | null>(null);
  const { min, max } = niceRange(months.map((m) => m.netWorthMinor));
  const y = (v: number) => ((max - v) / (max - min)) * HEIGHT;
  // Each month's point sits in the middle of its column.
  const x = (i: number) => ((i + 0.5) / months.length) * 100;
  // Months before anything was tracked have no net worth, not a zero one: the line starts later.
  const tracked = (m: NetWorthMonth) => m.assetsMinor !== 0 || m.liabilitiesMinor !== 0;
  const firstTracked = Math.max(0, months.findIndex(tracked));
  const points = months
    .map((m, i) => `${x(i)},${y(m.netWorthMinor)}`)
    .slice(firstTracked)
    .join(" ");
  const gridlines = [max, (max + min) / 2, min].filter((v, i, all) => all.indexOf(v) === i);

  return (
    <div className="relative pl-12">
      {/* Recessive grid; zero is the stronger baseline. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{ height: HEIGHT }}
        aria-hidden
      >
        {[...new Set([...gridlines, 0])].map((v) => (
          <div
            key={v}
            className={cn(
              "absolute inset-x-0 border-t",
              v === 0 ? "border-foreground/30" : "border-dashed border-border",
            )}
            style={{ top: y(v) }}
          >
            <span className="absolute -top-2 left-0 bg-card pr-1 text-[0.65rem] text-muted-foreground tabular-nums">
              {formatMoneyShort(v, currency)}
            </span>
          </div>
        ))}
      </div>

      <div className="relative" style={{ height: HEIGHT }}>
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 100 ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
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
          <polyline
            points={points}
            fill="none"
            className="stroke-viz-series-1"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Markers as HTML, so they stay round however the plot stretches. */}
        {months.map((m, i) =>
          i < firstTracked ? null : (
            <span
              key={m.month}
              aria-hidden
              className={cn(
                "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-viz-series-1 ring-2 ring-card",
                hovered === i && "size-3",
              )}
              style={{ left: `${x(i)}%`, top: y(m.netWorthMinor) }}
            />
          ),
        )}

        {/* Whole-column hit targets, focusable, each announcing its month. */}
        <ol
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}
        >
          {months.map((m, i) => (
            <li key={m.month} className="relative">
              <button
                type="button"
                aria-label={t("finance.reports.netWorth.screenReaderMonth", {
                  month: formatMonth(m.month),
                  net: formatMoney(m.netWorthMinor, currency),
                  assets: formatMoney(m.assetsMinor, currency),
                  liabilities: formatMoney(m.liabilitiesMinor, currency),
                })}
                className="h-full w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
              />
              {hovered === i && (
                <div
                  role="tooltip"
                  className={cn(
                    "pointer-events-none absolute bottom-full z-10 mb-1 w-48 rounded-lg border bg-card p-3 text-xs text-card-foreground shadow-md",
                    i > months.length / 2 ? "right-0" : "left-0",
                  )}
                >
                  <p className="mb-1.5 font-medium">{formatMonth(m.month)}</p>
                  <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-muted-foreground">
                    <dt>{t("finance.reports.netWorth.net")}</dt>
                    <dd className="text-right font-medium text-foreground tabular-nums">
                      {formatMoney(m.netWorthMinor, currency)}
                    </dd>
                    <dt>{t("finance.reports.netWorth.assets")}</dt>
                    <dd className="text-right text-foreground tabular-nums">
                      {formatMoney(m.assetsMinor, currency)}
                    </dd>
                    <dt>{t("finance.reports.netWorth.liabilities")}</dt>
                    <dd className="text-right text-foreground tabular-nums">
                      {formatMoney(m.liabilitiesMinor, currency)}
                    </dd>
                  </dl>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
      <ol
        className="mt-1 grid"
        style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}
        aria-hidden
      >
        {months.map((m) => (
          <li key={m.month} className="truncate text-center text-[0.65rem] text-muted-foreground">
            {shortMonth(m.month)}
          </li>
        ))}
      </ol>
    </div>
  );
}

function NetWorthTable({ months, currency }: { months: NetWorthMonth[]; currency: string }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-3 font-medium">{t("finance.reports.netWorth.month")}</th>
            <th className="px-3 py-2 text-right font-medium">
              {t("finance.reports.netWorth.assets")}
            </th>
            <th className="px-3 py-2 text-right font-medium">
              {t("finance.reports.netWorth.liabilities")}
            </th>
            <th className="py-2 pl-3 text-right font-medium">
              {t("finance.reports.netWorth.net")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {[...months].reverse().map((m) => (
            <tr key={m.month}>
              <td className="py-2 pr-3">{formatMonth(m.month)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatMoney(m.assetsMinor, currency)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatMoney(m.liabilitiesMinor, currency)}
              </td>
              <td
                className={cn(
                  "py-2 pl-3 text-right tabular-nums",
                  m.netWorthMinor < 0 && moneyToneClass(m.netWorthMinor),
                )}
              >
                {formatMoney(m.netWorthMinor, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
