import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { ActionError, EmptyRow, PageHeader } from "#components/PageHeader";
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
import { ViewTabs } from "#components/ViewTabs";
import {
  ADMIN_ACCOUNTS_QUERY,
  ARCHIVE_ACCOUNT_MUTATION,
  SET_DEFAULT_ACCOUNT_MUTATION,
  UNARCHIVE_ACCOUNT_MUTATION,
} from "#graphql/admin";
import type { AccountType, AdminAccount } from "#graphql/types";
import { formatDate, formatMoney } from "#lib/format";
import { useAction } from "#lib/use-action";

export const Route = createFileRoute("/accounts")({
  validateSearch: z.object({
    view: z.enum(["active", "archived"]).catch("active").default("active"),
  }),
  // The default tab is the bare path, as in apps/web.
  search: { middlewares: [stripSearchParams({ view: "active" })] },
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({ query: ADMIN_ACCOUNTS_QUERY });
  },
  component: AccountsPage,
});

const TYPE_LABELS: Record<AccountType, string> = {
  CURRENT: "Current",
  SAVINGS: "Savings",
  CREDIT_CARD: "Credit card",
  LOAN: "Loan",
  IOU: "IOU",
  CASH: "Cash",
  INVESTMENT: "Investment",
};

const refetch = { refetchQueries: ["AdminAccounts"], awaitRefetchQueries: true };

function AccountsPage() {
  const { view } = Route.useSearch();
  const { data } = useQuery<{ accounts: AdminAccount[]; archivedAccounts: AdminAccount[] }>(
    ADMIN_ACCOUNTS_QUERY,
  );
  const [archive] = useMutation(ARCHIVE_ACCOUNT_MUTATION, refetch);
  const [unarchive] = useMutation(UNARCHIVE_ACCOUNT_MUTATION, refetch);
  const [setDefault] = useMutation(SET_DEFAULT_ACCOUNT_MUTATION, refetch);
  const { run, pending, error } = useAction();
  if (!data) return null;
  const rows = view === "active" ? data.accounts : data.archivedAccounts;

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Money accounts. Archiving hides one from quick log and totals but keeps its history."
      />
      <ViewTabs
        label="Accounts"
        views={[
          { view: "active", label: "Active", count: data.accounts.length },
          { view: "archived", label: "Archived", count: data.archivedAccounts.length },
        ]}
        current={view}
      />
      <ActionError error={error} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Institution</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Tracked since</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <EmptyRow colSpan={6}>
              {view === "active" ? "No accounts yet." : "Nothing archived."}
            </EmptyRow>
          )}
          {rows.map((account) => (
            <TableRow key={account.id}>
              <TableCell>
                <span className="font-medium">
                  {account.icon && <span aria-hidden>{account.icon} </span>}
                  {account.name}
                </span>
                {account.isDefault && (
                  <Badge variant="secondary" className="ml-2">
                    Default
                  </Badge>
                )}
              </TableCell>
              <TableCell>{TYPE_LABELS[account.type]}</TableCell>
              <TableCell className="text-muted-foreground">
                {[account.institution, account.last4 && `•••• ${account.last4}`]
                  .filter(Boolean)
                  .join(" ") || "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(account.balanceMinor, account.currency)}
              </TableCell>
              <TableCell>{formatDate(account.openingBalanceDate)}</TableCell>
              <TableCell className="space-x-2 text-right">
                {view === "active" && !account.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending !== null}
                    onClick={() =>
                      run(`default:${account.id}`, () =>
                        setDefault({ variables: { id: account.id } }),
                      )
                    }
                  >
                    Make default
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending !== null}
                  onClick={() =>
                    run(`archive:${account.id}`, () =>
                      (view === "active" ? archive : unarchive)({ variables: { id: account.id } }),
                    )
                  }
                >
                  {pending === `archive:${account.id}`
                    ? "Working…"
                    : view === "active"
                      ? "Archive"
                      : "Restore"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
