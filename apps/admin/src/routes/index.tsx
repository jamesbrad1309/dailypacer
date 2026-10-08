import { useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "#components/PageHeader";
import { PageSkeleton } from "#components/RouteStatus";
import { Card, CardContent, CardHeader, CardTitle } from "#components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#components/ui/table";
import { ADMIN_OVERVIEW_QUERY } from "#graphql/admin";
import type { AdminOverview } from "#graphql/types";
import { formatCount, formatDate, formatUptime } from "#lib/format";

export const Route = createFileRoute("/")({
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({ query: ADMIN_OVERVIEW_QUERY, fetchPolicy: "network-only" });
  },
  component: OverviewPage,
});

const AREAS: { area: AdminOverview["tables"][number]["area"]; label: string }[] = [
  { area: "habits", label: "Habits" },
  { area: "journal", label: "Journal" },
  { area: "finance", label: "Money" },
  { area: "tasks", label: "Tasks" },
];

function OverviewPage() {
  const { data, error } = useQuery<{ adminOverview: AdminOverview }>(ADMIN_OVERVIEW_QUERY);
  // A failed refetch: hand it to the route's error page (RouteError).
  if (error) throw error;
  if (!data) return <PageSkeleton />;
  const { tables, database, server } = data.adminOverview;
  return (
    <>
      <PageHeader
        title="Overview"
        description="How much is in the database across everyone (counts only), and the API serving it."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AREAS.map(({ area, label }) => {
          const rows = tables.filter((t) => t.area === area);
          return (
            <Card key={area}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatCount(rows.reduce((sum, t) => sum + t.rows, 0))}
                </p>
                <p className="text-xs text-muted-foreground">
                  rows across {rows.length} {rows.length === 1 ? "table" : "tables"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="tables-heading">
          <h2 id="tables-heading" className="mb-2 font-medium">
            Tables
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead>Area</TableHead>
                <TableHead className="text-right">Rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tables.map((t) => (
                <TableRow key={t.table}>
                  <TableCell className="font-mono text-xs">{t.table}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {AREAS.find((a) => a.area === t.area)?.label}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(t.rows)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                <Fact label="Migrations applied" value={formatCount(database.migrations)} />
                <Fact
                  label="Latest"
                  value={database.latestMigration ?? "None"}
                  mono={Boolean(database.latestMigration)}
                />
                {database.latestAppliedAt && (
                  <Fact label="Applied" value={formatDate(database.latestAppliedAt)} />
                )}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>API</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                <Fact label="Up for" value={formatUptime(server.uptimeSeconds)} />
                <Fact label="Started" value={new Date(server.startedAt).toLocaleString("en-GB")} />
                <Fact label="Node" value={server.nodeVersion} mono />
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "truncate font-mono text-xs leading-5" : "truncate"}>{value}</dd>
    </div>
  );
}
