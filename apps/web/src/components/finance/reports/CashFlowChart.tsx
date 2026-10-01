import { useQuery } from "@apollo/client/react";
import { ChartBar, Table2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { moneyToneClass } from "#components/finance/Amount";
import { UnconvertedNote } from "#components/finance/reports/UnconvertedNote";
import { Button } from "#components/ui/button";
import { Card, CardContent } from "#components/ui/card";
import { CASH_FLOW_QUERY } from "#graphql/finance";
import type { CashFlowMonth, CashFlowReport } from "#graphql/types";
import { useStoredState } from "#hooks/useStoredState";
import { getLocale } from "#i18n/locale";
import { formatMonth, fromIsoDate } from "#lib/dates";
import { formatMoney, formatMoneyShort } from "#lib/money";
import { cn } from "#lib/utils";

const MONTHS = 12;

/** "2026-09" → "Sep" ("thg 9"), for the axis. */
function shortMonth(month: string): string {
  return fromIsoDate(`${month}-01`).toLocaleDateString(getLocale(), { month: "short" });
}

/** A round number at or above `max` for the top gridline: 1,840 → 2,000. */
function niceCeil(max: number): number {
  if (max <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= max) return m * step;
  return 10 * step;
}

const signed = (minor: number, currency: string) =>
  `${minor > 0 ? "+" : minor < 0 ? "−" : ""}${formatMoney(Math.abs(minor), currency)}`;

/**
 * Money in vs out for the 12 months up to `month`: paired columns on one
 * axis (in = categorical slot 1, out = slot 2; green and red are kept for
 * status), the net in the tooltip and the table. Clicking a month opens it.
 */
export function CashFlowChart({
  month,
  onSelectMonth,
}: {
  month: string;
  onSelectMonth: (month: string) => void;
}) {
  const { t } = useTranslation();
  const { data, error } = useQuery<{ cashFlow: CashFlowReport }>(CASH_FLOW_QUERY, {
    variables: { to: month, months: MONTHS },
  });
  const [asTable, setAsTable] = useStoredState("lifeos.cashFlow.asTable", false);
  const report = data?.cashFlow;

  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!report) return null;

  const { currency, months } = report;
  const totalIn = months.reduce((sum, m) => sum + m.inMinor, 0);
  const totalOut = months.reduce((sum, m) => sum + m.outMinor, 0);
  const net = totalIn - totalOut;
  const active = months.filter((m) => m.inMinor !== 0 || m.outMinor !== 0);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">{t("finance.spending.cashFlow.title")}</h2>
            <p className="text-xs text-muted-foreground">
              {t("finance.spending.cashFlow.subtitle", { month: formatMonth(month) })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {!asTable && (
              <ul className="flex items-center gap-3 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-viz-series-1" />
                  {t("finance.spending.cashFlow.in")}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-viz-series-2" />
                  {t("finance.spending.cashFlow.out")}
                </li>
              </ul>
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={asTable}
              onClick={() => setAsTable(!asTable)}
            >
              {asTable ? <ChartBar className="size-3.5" /> : <Table2 className="size-3.5" />}
              {asTable ? t("finance.spending.chart") : t("finance.spending.table")}
            </Button>
          </div>
        </div>

        {active.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("finance.spending.cashFlow.empty")}
          </p>
        ) : (
          <>
            <p className="text-sm">
              <span className={cn("font-medium", moneyToneClass(net))}>
                {net >= 0
                  ? t("finance.spending.cashFlow.saved", { amount: formatMoney(net, currency) })
                  : t("finance.spending.cashFlow.overspent", {
                      amount: formatMoney(-net, currency),
                    })}
              </span>
              <span className="text-muted-foreground">
                {" · "}
                {t("finance.spending.cashFlow.average", {
                  in: formatMoney(Math.round(totalIn / active.length), currency),
                  out: formatMoney(Math.round(totalOut / active.length), currency),
                })}
              </span>
            </p>
            {asTable ? (
              <CashFlowTable months={months} currency={currency} />
            ) : (
              <Columns
                months={months}
                currency={currency}
                selected={month}
                onSelect={onSelectMonth}
              />
            )}
          </>
        )}
        <UnconvertedNote codes={report.unconverted} />
      </CardContent>
    </Card>
  );
}

function Columns({
  months,
  currency,
  selected,
  onSelect,
}: {
  months: CashFlowMonth[];
  currency: string;
  selected: string;
  onSelect: (month: string) => void;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<string | null>(null);
  const top = niceCeil(Math.max(...months.flatMap((m) => [m.inMinor, m.outMinor])));
  const pct = (minor: number) => `${(Math.max(0, minor) / top) * 100}%`;

  return (
    <div className="relative">
      {/* Recessive grid: top, middle and the baseline, labelled on the left. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40" aria-hidden>
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
                {formatMoneyShort(top * f, currency)}
              </span>
            )}
          </div>
        ))}
      </div>

      <ol className="relative grid grid-cols-12 gap-0.5 pl-10 sm:gap-1">
        {months.map((m) => {
          const label = t("finance.spending.cashFlow.screenReaderMonth", {
            month: formatMonth(m.month),
            in: formatMoney(m.inMinor, currency),
            out: formatMoney(m.outMinor, currency),
            net: signed(m.netMinor, currency),
          });
          return (
            <li
              key={m.month}
              className="relative"
              onMouseEnter={() => setHovered(m.month)}
              onMouseLeave={() => setHovered(null)}
            >
              <button
                type="button"
                aria-label={label}
                aria-current={m.month === selected ? "date" : undefined}
                onClick={() => onSelect(m.month)}
                onFocus={() => setHovered(m.month)}
                onBlur={() => setHovered(null)}
                className={cn(
                  "flex w-full flex-col rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hovered === m.month && "bg-accent/50",
                )}
              >
                {/* The plot: the whole column is the hit target, the marks stay thin. */}
                <span className="flex h-40 items-end justify-center gap-0.5 px-0.5" aria-hidden>
                  <span
                    className="w-full max-w-3 rounded-t-[4px] bg-viz-series-1 transition-[height] duration-300"
                    style={{ height: pct(m.inMinor) }}
                  />
                  <span
                    className="w-full max-w-3 rounded-t-[4px] bg-viz-series-2 transition-[height] duration-300"
                    style={{ height: pct(m.outMinor) }}
                  />
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 truncate text-center text-[0.65rem] text-muted-foreground",
                    m.month === selected && "font-semibold text-foreground",
                  )}
                >
                  {shortMonth(m.month)}
                </span>
              </button>

              {hovered === m.month && (
                <div
                  role="tooltip"
                  className={cn(
                    "pointer-events-none absolute bottom-full z-10 mb-1 w-44 rounded-lg border bg-card p-3 text-xs text-card-foreground shadow-md",
                    // Keep the tooltip on screen at either end of the year.
                    months.indexOf(m) > 7 ? "right-0" : "left-0",
                  )}
                >
                  <p className="mb-1.5 font-medium">{formatMonth(m.month)}</p>
                  <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-muted-foreground">
                    <dt className="flex items-center gap-1.5">
                      <span className="size-2 rounded-sm bg-viz-series-1" />
                      {t("finance.spending.cashFlow.in")}
                    </dt>
                    <dd className="text-right text-foreground tabular-nums">
                      {formatMoney(m.inMinor, currency)}
                    </dd>
                    <dt className="flex items-center gap-1.5">
                      <span className="size-2 rounded-sm bg-viz-series-2" />
                      {t("finance.spending.cashFlow.out")}
                    </dt>
                    <dd className="text-right text-foreground tabular-nums">
                      {formatMoney(m.outMinor, currency)}
                    </dd>
                    <dt>{t("finance.spending.cashFlow.net")}</dt>
                    <dd className={cn("text-right tabular-nums", moneyToneClass(m.netMinor))}>
                      {signed(m.netMinor, currency)}
                    </dd>
                  </dl>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The same numbers as a table: for screen readers, copying, and exact comparison. */
function CashFlowTable({ months, currency }: { months: CashFlowMonth[]; currency: string }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 pr-3 font-medium">{t("finance.spending.cashFlow.month")}</th>
            <th className="px-3 py-2 text-right font-medium">
              {t("finance.spending.cashFlow.in")}
            </th>
            <th className="px-3 py-2 text-right font-medium">
              {t("finance.spending.cashFlow.out")}
            </th>
            <th className="py-2 pl-3 text-right font-medium">
              {t("finance.spending.cashFlow.net")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {[...months].reverse().map((m) => (
            <tr key={m.month}>
              <td className="py-2 pr-3">{formatMonth(m.month)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatMoney(m.inMinor, currency)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatMoney(m.outMinor, currency)}
              </td>
              <td className={cn("py-2 pl-3 text-right tabular-nums", moneyToneClass(m.netMinor))}>
                {signed(m.netMinor, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
