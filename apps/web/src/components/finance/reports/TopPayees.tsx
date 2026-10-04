import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { UnconvertedNote } from "#components/finance/reports/UnconvertedNote";
import { Card, CardContent } from "#components/ui/card";
import { TOP_PAYEES_QUERY } from "#graphql/finance";
import type { TopPayeesData } from "#graphql/types";
import { formatMonth, monthRange } from "#lib/dates";
import { formatMoney } from "#lib/money";

const LIMIT = 10;

/**
 * The month's biggest payees: a ranked list with a thin bar each (one
 * series, so one colour; the amount is written out beside it). Each opens
 * the month's transactions searched by that payee.
 */
export function TopPayees({ month }: { month: string }) {
  const { t } = useTranslation();
  const range = monthRange(month);
  const { data, error } = useQuery<TopPayeesData>(TOP_PAYEES_QUERY, {
    variables: { from: range.from, to: range.to, limit: LIMIT },
  });
  const report = data?.topPayees;

  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!report) return null;
  const top = report.payees[0]?.spentMinor ?? 1;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-medium">{t("finance.reports.topPayees.title")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("finance.reports.topPayees.subtitle", { month: formatMonth(month) })}
          </p>
        </div>
        {report.payees.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("finance.reports.topPayees.empty", { month: formatMonth(month) })}
          </p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {report.payees.map((p) => (
              <li key={p.payee}>
                <Link
                  to="/finance/transactions"
                  search={{ q: p.payee, month }}
                  className="group flex flex-col gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate group-hover:underline">{p.payee}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatMoney(p.spentMinor, report.currency)}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t("finance.reports.topPayees.count", { count: p.transactionCount })}
                      </span>
                    </span>
                  </span>
                  <span className="h-1.5 rounded-full bg-muted" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-viz-series-2"
                      style={{ width: `${Math.max(2, (p.spentMinor / top) * 100)}%` }}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
        <UnconvertedNote codes={report.unconverted} />
      </CardContent>
    </Card>
  );
}
