import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { ActionError, PageHeader } from "#components/PageHeader";
import { PromptDialog } from "#components/PromptDialog";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#components/ui/table";
import {
  ADMIN_CURRENCIES_QUERY,
  REFRESH_RATES_MUTATION,
  SET_MAIN_CURRENCY_MUTATION,
  SET_RATE_OVERRIDE_MUTATION,
} from "#graphql/admin";
import type { AdminCurrency, AdminCurrencySettings } from "#graphql/types";
import { formatDate } from "#lib/format";
import { formatRate, rateProblem } from "#lib/rates";
import { useAction } from "#lib/use-action";

export const Route = createFileRoute("/currencies")({
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({ query: ADMIN_CURRENCIES_QUERY });
  },
  component: CurrenciesPage,
});

const refetch = { refetchQueries: ["AdminCurrencies"], awaitRefetchQueries: true };

type Dialog = { kind: "main"; currency: AdminCurrency } | { kind: "rate"; currency: AdminCurrency };

function CurrenciesPage() {
  const { data } = useQuery<{ currencySettings: AdminCurrencySettings }>(ADMIN_CURRENCIES_QUERY);
  const [setMain] = useMutation(SET_MAIN_CURRENCY_MUTATION, refetch);
  const [setOverride] = useMutation(SET_RATE_OVERRIDE_MUTATION, refetch);
  const [refresh] = useMutation(REFRESH_RATES_MUTATION, refetch);
  const { run, pending, error } = useAction();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  if (!data) return null;
  const { currencies, rates } = data.currencySettings;
  const main = currencies.find((c) => c.isMain);

  return (
    <>
      <PageHeader
        title="Currencies"
        description={
          rates
            ? `Rates from ${rates.source}, for ${formatDate(rates.date)}.`
            : "No exchange rates fetched yet."
        }
        actions={
          <Button
            variant="outline"
            disabled={pending !== null}
            onClick={() => run("refresh", () => refresh())}
          >
            <RefreshCw className={pending === "refresh" ? "animate-spin" : undefined} aria-hidden />
            Fetch today's rates
          </Button>
        }
      />
      <ActionError error={error} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead className="text-right">Market rate</TableHead>
            <TableHead className="text-right">Override</TableHead>
            <TableHead className="text-right">In use</TableHead>
            <TableHead className="text-right">Accounts</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currencies.map((currency) => (
            <TableRow key={currency.code}>
              <TableCell className="font-mono">
                {currency.code}
                {currency.isMain && (
                  <Badge variant="secondary" className="ml-2 font-sans">
                    Main
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {currency.isMain ? "—" : formatRate(currency.marketRateToMain)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatRate(currency.overrideToMain)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {currency.isMain ? "1" : formatRate(currency.rateToMain)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{currency.accountCount}</TableCell>
              <TableCell className="space-x-2 text-right">
                {!currency.isMain && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending !== null}
                      onClick={() => setDialog({ kind: "rate", currency })}
                    >
                      Set rate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending !== null}
                      onClick={() => setDialog({ kind: "main", currency })}
                    >
                      Make main
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-2 text-xs text-muted-foreground">
        Rates are {main?.code ?? "main-currency"} units per 1 unit of each currency.
        {rates && (
          <>
            {" "}
            <a href={rates.attribution.url} className="underline" target="_blank" rel="noreferrer">
              {rates.attribution.label}
            </a>
            .
          </>
        )}
      </p>

      <PromptDialog
        open={dialog?.kind === "main"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Make ${dialog?.currency.code} the main currency?`}
        description="Totals and reports switch to it, and every rate override is cleared (they were relative to the old main currency)."
        confirmLabel="Make main"
        pending={pending !== null}
        onConfirm={() => {
          const code = dialog?.currency.code ?? "";
          return run(`main:${code}`, () => setMain({ variables: { code } }));
        }}
      />
      <PromptDialog
        open={dialog?.kind === "rate"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`${dialog?.currency.code} rate`}
        description={`Your own rate, in ${main?.code} per 1 ${dialog?.currency.code}. Leave it blank to use the fetched rate.`}
        confirmLabel="Save rate"
        field={{
          label: "Rate",
          initial: dialog?.currency.overrideToMain?.toString() ?? "",
          inputMode: "decimal",
          placeholder: formatRate(dialog?.currency.marketRateToMain ?? null),
          validate: rateProblem,
        }}
        pending={pending !== null}
        onConfirm={(value) => {
          const code = dialog?.currency.code ?? "";
          return run(`rate:${code}`, () =>
            setOverride({ variables: { code, rateToMain: value === "" ? null : Number(value) } }),
          );
        }}
      />
    </>
  );
}
