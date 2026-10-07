import { useApolloClient } from "@apollo/client/react";
import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";
import { TRANSACTIONS_QUERY } from "#graphql/finance";
import type { Transaction, TransactionFilter, TransactionsData } from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { transactionsToCsv } from "#lib/csv-export";
import { currencyDigits } from "#lib/money";
import { toast } from "#lib/toast";

/** The API's largest page: few round trips for a long export. */
const EXPORT_PAGE = 200;

/**
 * Downloads every transaction the current filter matches as CSV, built in
 * the browser: it pages through `transactions` (bypassing the cache, so a
 * long export doesn't fill it) and saves one file.
 */
export function ExportCsvButton({
  filter,
  fileName,
}: {
  filter: TransactionFilter;
  fileName: string;
}) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const categoryName = useCategoryName();
  const [busy, setBusy] = useState(false);

  async function exportCsv() {
    setBusy(true);
    try {
      const all: Transaction[] = [];
      let after: string | null = null;
      do {
        const { data }: { data?: TransactionsData } = await client.query<TransactionsData>({
          query: TRANSACTIONS_QUERY,
          variables: { filter, first: EXPORT_PAGE, after },
          fetchPolicy: "no-cache",
        });
        if (!data) break;
        all.push(...data.transactions.items);
        after = data.transactions.nextCursor;
      } while (after);

      const csv = transactionsToCsv(
        all,
        {
          date: t("finance.transactions.export.headings.date"),
          account: t("finance.transactions.export.headings.account"),
          payee: t("finance.transactions.export.headings.payee"),
          category: t("finance.transactions.export.headings.category"),
          amount: t("finance.transactions.export.headings.amount"),
          currency: t("finance.transactions.export.headings.currency"),
          note: t("finance.transactions.export.headings.note"),
          tags: t("finance.transactions.export.headings.tags"),
          status: t("finance.transactions.export.headings.status"),
        },
        categoryName,
        currencyDigits,
      );
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast(t("finance.transactions.export.done", { count: all.length }));
    } catch {
      toast(t("finance.transactions.export.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={exportCsv}>
      <Download className="size-4" />
      {busy ? t("finance.transactions.export.exporting") : t("finance.transactions.export.button")}
    </Button>
  );
}
