import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListSkeleton } from "#components/layout/Skeletons";
import { TaskDialog } from "#components/todos/TaskDialog";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import {
  CREATE_TODO_LIST_MUTATION,
  DELETE_TODO_LIST_MUTATION,
  SUGGEST_PREFIX_QUERY,
  TASK_BY_KEY_QUERY,
  TODO_LISTS_QUERY,
  TODO_REFETCH,
  UPDATE_TODO_LIST_MUTATION,
} from "#graphql/todos";
import type { Task, TodoList, TodoListsData } from "#graphql/types";
import { PREFIX_PATTERN, listName } from "#lib/todos";

/** Lists with their key prefixes, a form for a new one, and "go to GRO-12". */
export function ListsView() {
  const { t } = useTranslation();
  const { data, loading, error } = useQuery<TodoListsData>(TODO_LISTS_QUERY);
  const [editing, setEditing] = useState<TodoList | null>(null);

  if (loading && !data) return <ListSkeleton rows={3} />;
  if (error) return <p className="text-destructive">{error.message}</p>;
  const lists = data?.todoLists ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <NewListForm />
        <FindByKey />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("todos.lists.title")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {lists.map((list) => (
            <div key={list.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to="/tasks/lists/$listId"
                  params={{ listId: list.id }}
                  className="min-w-0 font-medium hover:underline"
                >
                  <span className="block truncate">{listName(list, t)}</span>
                </Link>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {list.prefix}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("todos.lists.open", { count: list.openCount })} ·{" "}
                {t("todos.lists.done", { count: list.doneCount })}
              </p>
              <div className="mt-auto flex justify-end border-t pt-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(list)}>
                  <Pencil className="size-3.5" /> {t("common.edit")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && <EditList key={editing.id} list={editing} onClose={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}

function NewListForm() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  // Follows the name's suggestion until the user types their own prefix.
  const [prefixTouched, setPrefixTouched] = useState(false);
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(name.trim()), 300);
    return () => clearTimeout(timer);
  }, [name]);
  const { data: suggestion } = useQuery<{ suggestListPrefix: string }>(SUGGEST_PREFIX_QUERY, {
    variables: { name: debounced },
    skip: !debounced,
  });
  const shownPrefix = prefixTouched ? prefix : (suggestion?.suggestListPrefix ?? "");
  const valid = PREFIX_PATTERN.test(shownPrefix);

  const [createList, creating] = useMutation(CREATE_TODO_LIST_MUTATION, {
    refetchQueries: TODO_REFETCH,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !valid) return;
    await createList({ variables: { input: { name: name.trim(), prefix: shownPrefix } } });
    setName("");
    setPrefix("");
    setPrefixTouched(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="font-medium">{t("todos.lists.newList")}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <Label htmlFor="list-name">{t("todos.lists.name")}</Label>
          <Input
            id="list-name"
            placeholder={t("todos.lists.namePlaceholder")}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex w-32 flex-col gap-2">
          <Label htmlFor="list-prefix">{t("todos.lists.prefix")}</Label>
          <Input
            id="list-prefix"
            className="font-mono uppercase"
            value={shownPrefix}
            maxLength={6}
            aria-invalid={shownPrefix !== "" && !valid}
            onChange={(e) => {
              setPrefixTouched(true);
              setPrefix(e.target.value.toUpperCase());
            }}
          />
        </div>
        <Button type="submit" disabled={creating.loading || !name.trim() || !valid}>
          <Plus className="size-4" /> {t("todos.lists.create")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {shownPrefix && !valid
          ? t("todos.lists.prefixInvalid")
          : t("todos.lists.prefixHint", {
              example: `${shownPrefix || "GRO"}-1, ${shownPrefix || "GRO"}-2…`,
            })}
      </p>
      {creating.error && <p className="text-sm text-destructive">{creating.error.message}</p>}
    </form>
  );
}

function EditList({ list, onClose }: { list: TodoList; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(list.name);
  const [prefix, setPrefix] = useState(list.prefix);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const valid = PREFIX_PATTERN.test(prefix);

  const [updateList, updating] = useMutation(UPDATE_TODO_LIST_MUTATION, {
    refetchQueries: TODO_REFETCH,
  });
  const [deleteList, deleting] = useMutation(DELETE_TODO_LIST_MUTATION, {
    refetchQueries: TODO_REFETCH,
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!valid || !name.trim()) return;
    await updateList({
      variables: {
        id: list.id,
        input: {
          name: list.isInbox ? undefined : name.trim(),
          prefix: prefix !== list.prefix ? prefix : undefined,
        },
      },
    });
    onClose();
  }

  return (
    <DialogContent>
      <form onSubmit={save} className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("todos.lists.editList")}</DialogTitle>
        </DialogHeader>
        {!list.isInbox && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-list-name">{t("todos.lists.name")}</Label>
            <Input
              id="edit-list-name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-list-prefix">{t("todos.lists.prefix")}</Label>
          <Input
            id="edit-list-prefix"
            className="w-32 font-mono uppercase"
            value={prefix}
            maxLength={6}
            aria-invalid={!valid}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
          />
          <p className="text-xs text-muted-foreground">
            {!valid
              ? t("todos.lists.prefixInvalid")
              : prefix !== list.prefix
                ? t("todos.lists.renameHint", { from: `${list.prefix}-1`, to: `${prefix}-1` })
                : t("todos.lists.prefixHint", { example: `${prefix}-1, ${prefix}-2…` })}
          </p>
        </div>
        {updating.error && <p className="text-sm text-destructive">{updating.error.message}</p>}

        <DialogFooter className="sm:justify-between">
          {list.isInbox ? (
            <p className="text-xs text-muted-foreground sm:max-w-60">
              {t("todos.lists.inboxNoDelete")}
            </p>
          ) : confirmingDelete ? (
            <Button
              type="button"
              variant="destructive"
              disabled={deleting.loading}
              onClick={async () => {
                await deleteList({ variables: { id: list.id } });
                onClose();
              }}
            >
              <Trash2 className="size-4" /> {t("todos.lists.confirmDelete")}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="size-4" /> {t("todos.lists.delete")}
            </Button>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={updating.loading || !valid || !name.trim()}>
              {t("common.save")}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/** Type a key like GRO-12 to open that task, whatever list it's in now. */
function FindByKey() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [key, setKey] = useState("");
  const [found, setFound] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await client.query<{ taskByKey: Task }>({
        query: TASK_BY_KEY_QUERY,
        variables: { key: key.trim() },
        fetchPolicy: "network-only",
      });
      if (data) setFound(data.taskByKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={go} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <Label htmlFor="find-key" className="font-medium">
        {t("todos.lists.findKey")}
      </Label>
      <div className="flex gap-2">
        <Input
          id="find-key"
          className="font-mono uppercase"
          placeholder={t("todos.lists.findPlaceholder")}
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
        />
        <Button type="submit" variant="outline" disabled={!key.trim()}>
          {t("todos.lists.go")}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <TaskDialog task={found} onClose={() => setFound(null)} />
    </form>
  );
}
