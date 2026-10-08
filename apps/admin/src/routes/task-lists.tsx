import { useMutation, useQuery } from "@apollo/client/react";
import { createFileRoute } from "@tanstack/react-router";
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
  ADMIN_TODO_LISTS_QUERY,
  DELETE_TODO_LIST_MUTATION,
  RENAME_TODO_LIST_MUTATION,
} from "#graphql/admin";
import type { AdminTodoList } from "#graphql/types";
import { formatCount, formatDate } from "#lib/format";
import { useAction } from "#lib/use-action";

export const Route = createFileRoute("/task-lists")({
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({ query: ADMIN_TODO_LISTS_QUERY });
  },
  component: TaskListsPage,
});

const refetch = { refetchQueries: ["AdminTodoLists"], awaitRefetchQueries: true };

type Dialog = { kind: "rename" | "delete"; list: AdminTodoList };

function TaskListsPage() {
  const { data } = useQuery<{ todoLists: AdminTodoList[] }>(ADMIN_TODO_LISTS_QUERY);
  const [rename] = useMutation(RENAME_TODO_LIST_MUTATION, refetch);
  const [remove] = useMutation(DELETE_TODO_LIST_MUTATION, refetch);
  const { run, pending, error } = useAction();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  if (!data) return null;
  const list = dialog?.list;
  const taskCount = list ? list.openCount + list.doneCount : 0;

  return (
    <>
      <PageHeader
        title="Task lists"
        description="The Inbox catches tasks added without a list, so it can't be deleted."
      />
      <ActionError error={error} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Prefix</TableHead>
            <TableHead className="text-right">Open</TableHead>
            <TableHead className="text-right">Done</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.todoLists.map((todoList) => (
            <TableRow key={todoList.id}>
              <TableCell className="font-medium">
                {todoList.name}
                {todoList.isInbox && (
                  <Badge variant="secondary" className="ml-2">
                    Inbox
                  </Badge>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">{todoList.prefix}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCount(todoList.openCount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCount(todoList.doneCount)}
              </TableCell>
              <TableCell>{formatDate(todoList.createdAt)}</TableCell>
              <TableCell className="space-x-2 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending !== null}
                  onClick={() => setDialog({ kind: "rename", list: todoList })}
                >
                  Rename
                </Button>
                {!todoList.isInbox && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={pending !== null}
                    onClick={() => setDialog({ kind: "delete", list: todoList })}
                  >
                    Delete
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <PromptDialog
        open={dialog?.kind === "rename"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Rename ${list?.name}`}
        description="Task keys keep the prefix; change that in the app's list settings."
        confirmLabel="Rename"
        field={{
          label: "Name",
          initial: list?.name ?? "",
          validate: (value) => (value.trim() === "" ? "A list needs a name." : null),
        }}
        pending={pending !== null}
        onConfirm={(name) =>
          run(`rename:${list?.id}`, () => rename({ variables: { id: list?.id, name } }))
        }
      />
      <PromptDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Delete ${list?.name}?`}
        description={`This deletes the list and its ${taskCount} ${taskCount === 1 ? "task" : "tasks"}. It can't be undone.`}
        confirmLabel="Delete list"
        destructive
        pending={pending !== null}
        onConfirm={() => run(`delete:${list?.id}`, () => remove({ variables: { id: list?.id } }))}
      />
    </>
  );
}
