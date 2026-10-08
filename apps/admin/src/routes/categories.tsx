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
import { ADMIN_CATEGORIES_QUERY, SET_CATEGORY_ARCHIVED_MUTATION } from "#graphql/admin";
import type { AdminCategory } from "#graphql/types";
import { useAction } from "#lib/use-action";

export const Route = createFileRoute("/categories")({
  validateSearch: z.object({
    view: z.enum(["expense", "income"]).catch("expense").default("expense"),
  }),
  // The default tab is the bare path, as in apps/web.
  search: { middlewares: [stripSearchParams({ view: "expense" })] },
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({ query: ADMIN_CATEGORIES_QUERY });
  },
  component: CategoriesPage,
});

/** Parents in order, each followed by its subcategories. */
function nested(categories: AdminCategory[]): { category: AdminCategory; depth: 0 | 1 }[] {
  const bySort = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  return bySort
    .filter((c) => !c.parentId)
    .flatMap((parent) => [
      { category: parent, depth: 0 as const },
      ...bySort
        .filter((c) => c.parentId === parent.id)
        .map((category) => ({ category, depth: 1 as const })),
    ]);
}

function CategoriesPage() {
  const { view } = Route.useSearch();
  const { data } = useQuery<{ categories: AdminCategory[] }>(ADMIN_CATEGORIES_QUERY);
  const [setArchived] = useMutation(SET_CATEGORY_ARCHIVED_MUTATION, {
    refetchQueries: ["AdminCategories"],
    awaitRefetchQueries: true,
  });
  const { run, pending, error } = useAction();
  if (!data) return null;
  const count = (kind: AdminCategory["kind"]) =>
    data.categories.filter((c) => c.kind === kind).length;
  const rows = nested(data.categories.filter((c) => c.kind === view));

  return (
    <>
      <PageHeader
        title="Categories"
        description="Archiving a category also archives its subcategories; old transactions keep it."
      />
      <ViewTabs
        label="Category kind"
        views={[
          { view: "expense", label: "Spending", count: count("expense") },
          { view: "income", label: "Income", count: count("income") },
        ]}
        current={view}
      />
      <ActionError error={error} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Aliases</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <EmptyRow colSpan={4}>No categories.</EmptyRow>}
          {rows.map(({ category, depth }) => (
            <TableRow key={category.id} className={category.archivedAt ? "opacity-60" : undefined}>
              <TableCell className={depth ? "pl-9" : "font-medium"}>
                {category.color && (
                  <span
                    aria-hidden
                    className="mr-2 inline-block size-2.5 rounded-full align-middle"
                    style={{ backgroundColor: category.color }}
                  />
                )}
                {category.icon && <span aria-hidden>{category.icon} </span>}
                {category.name}
              </TableCell>
              <TableCell className="max-w-64 truncate text-muted-foreground">
                {category.aliases.join(", ") || "—"}
              </TableCell>
              <TableCell>
                {category.isSystem ? (
                  <Badge variant="outline">Built in</Badge>
                ) : category.archivedAt ? (
                  <Badge variant="secondary">Archived</Badge>
                ) : (
                  <Badge variant="outline">Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {!category.isSystem && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending !== null}
                    onClick={() =>
                      run(category.id, () =>
                        setArchived({
                          variables: { id: category.id, archived: !category.archivedAt },
                        }),
                      )
                    }
                  >
                    {pending === category.id
                      ? "Working…"
                      : category.archivedAt
                        ? "Restore"
                        : "Archive"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
