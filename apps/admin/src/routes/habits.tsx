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
  ADMIN_HABITS_QUERY,
  ARCHIVE_HABIT_MUTATION,
  UNARCHIVE_HABIT_MUTATION,
} from "#graphql/admin";
import type { AdminHabit } from "#graphql/types";
import { formatCount, formatDate } from "#lib/format";
import { useAction } from "#lib/use-action";

export const Route = createFileRoute("/habits")({
  validateSearch: z.object({
    view: z.enum(["active", "archived"]).catch("active").default("active"),
  }),
  // The default tab is the bare path, as in apps/web.
  search: { middlewares: [stripSearchParams({ view: "active" })] },
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({ query: ADMIN_HABITS_QUERY });
  },
  component: HabitsPage,
});

const refetch = { refetchQueries: ["AdminHabits"], awaitRefetchQueries: true };

function HabitsPage() {
  const { view } = Route.useSearch();
  const { data } = useQuery<{ habits: AdminHabit[]; archivedHabits: AdminHabit[] }>(
    ADMIN_HABITS_QUERY,
  );
  const [archive] = useMutation(ARCHIVE_HABIT_MUTATION, refetch);
  const [unarchive] = useMutation(UNARCHIVE_HABIT_MUTATION, refetch);
  const { run, pending, error } = useAction();
  if (!data) return null;
  const rows = view === "active" ? data.habits : data.archivedHabits;

  return (
    <>
      <PageHeader
        title="Habits"
        description="Archiving hides a habit from today's list; its check-ins and streaks are kept."
      />
      <ViewTabs
        label="Habits"
        views={[
          { view: "active", label: "Active", count: data.habits.length },
          { view: "archived", label: "Archived", count: data.archivedHabits.length },
        ]}
        current={view}
      />
      <ActionError error={error} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead className="text-right">Streak</TableHead>
            <TableHead className="text-right">Check-ins</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <EmptyRow colSpan={7}>
              {view === "active" ? "No habits yet." : "Nothing archived."}
            </EmptyRow>
          )}
          {rows.map((habit) => (
            <TableRow key={habit.id}>
              <TableCell>
                <span
                  className="border-l-4 border-transparent pl-2 font-medium"
                  style={habit.color ? { borderLeftColor: habit.color } : undefined}
                >
                  {habit.icon && <span aria-hidden>{habit.icon} </span>}
                  {habit.name}
                </span>
                {habit.paused && (
                  <Badge variant="secondary" className="ml-2">
                    Paused
                  </Badge>
                )}
              </TableCell>
              <TableCell>{habit.polarity === "BUILD" ? "Build" : "Avoid"}</TableCell>
              <TableCell className="max-w-48 truncate text-muted-foreground">
                {habit.tags.map((tag) => `#${tag}`).join(" ") || "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">{habit.currentStreak}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCount(habit.totalCompletions)}
              </TableCell>
              <TableCell>{formatDate(habit.createdAt)}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending !== null}
                  onClick={() =>
                    run(habit.id, () =>
                      (view === "active" ? archive : unarchive)({ variables: { id: habit.id } }),
                    )
                  }
                >
                  {pending === habit.id ? "Working…" : view === "active" ? "Archive" : "Restore"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
