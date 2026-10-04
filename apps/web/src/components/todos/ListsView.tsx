import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListSkeleton } from "#components/layout/Skeletons";
import { ConfirmPrompt } from "#components/todos/ConfirmPrompt";
import { TaskDialog } from "#components/todos/TaskDialog";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { fieldErrors, listName, todoListSchema } from "#lib/todos";

/** Lists with their key prefixes; New list opens a modal; "go to GRO-12". */
export function ListsView() {
  const { t } = useTranslation();
  const { data, loading, error } = useQuery<TodoListsData>(TODO_LISTS_QUERY);
  const [editing, setEditing] = useState<TodoList | null>(null);

  if (loading && !data) return <ListSkeleton rows={3} />;
  if (error) return <p className="text-destructive">{error.message}</p>;
  const lists = data?.todoLists ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("todos.lists.title")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <FindByKey />
          <NewListDialog lists={lists} />
        </div>
      </div>

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

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <EditListForm
            key={editing.id}
            list={editing}
            lists={lists}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  );
}

/**
 * The name and prefix fields, validated with `todoListSchema` as you type:
 * format, length, and that no other list already uses the prefix.
 * Errors show once a field has been touched, and all of them on submit.
 */
function ListFields({
  name,
  prefix,
  errors,
  touched,
  onName,
  onPrefix,
  hint,
}: {
  name: string;
  prefix: string;
  errors: Partial<Record<string, string>>;
  touched: { name: boolean; prefix: boolean };
  onName: (value: string) => void;
  onPrefix: (value: string) => void;
  hint: string;
}) {
  const { t } = useTranslation();
  const nameError = touched.name ? errors.name : undefined;
  const prefixError = touched.prefix ? errors.prefix : undefined;
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="list-name">{t("todos.lists.name")}</Label>
        <Input
          id="list-name"
          autoFocus
          placeholder={t("todos.lists.namePlaceholder")}
          value={name}
          aria-invalid={!!nameError}
          aria-describedby={nameError ? "list-name-error" : undefined}
          onChange={(e) => onName(e.target.value)}
        />
        {nameError && (
          <p id="list-name-error" className="text-xs text-destructive">
            {nameError}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="list-prefix">{t("todos.lists.prefix")}</Label>
        <Input
          id="list-prefix"
          className="w-32 font-mono uppercase"
          value={prefix}
          maxLength={6}
          aria-invalid={!!prefixError}
          aria-describedby="list-prefix-hint"
          onChange={(e) => onPrefix(e.target.value.toUpperCase())}
        />
        <p
          id="list-prefix-hint"
          className={prefixError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
        >
          {prefixError ?? hint}
        </p>
      </div>
    </>
  );
}

/** The new/edit list form: its two fields, and which have been touched (to time error messages). */
interface ListFormState {
  name: string;
  prefix: string;
  /** New list only: the prefix follows the name's suggestion until the user types their own. */
  prefixTouched: boolean;
  touched: { name: boolean; prefix: boolean };
  confirmingDelete: boolean;
}

type ListFormAction =
  | { type: "name"; name: string }
  | { type: "prefix"; prefix: string }
  /** Submitting shows every field's error. */
  | { type: "touchAll" }
  | { type: "confirmDelete"; on: boolean }
  | { type: "reset"; state: ListFormState };

function listFormReducer(state: ListFormState, action: ListFormAction): ListFormState {
  switch (action.type) {
    case "name":
      return { ...state, name: action.name, touched: { ...state.touched, name: true } };
    case "prefix":
      return {
        ...state,
        prefix: action.prefix,
        prefixTouched: true,
        touched: { ...state.touched, prefix: true },
      };
    case "touchAll":
      return { ...state, touched: { name: true, prefix: true } };
    case "confirmDelete":
      return { ...state, confirmingDelete: action.on };
    case "reset":
      return action.state;
  }
}

const listForm = (name = "", prefix = ""): ListFormState => ({
  name,
  prefix,
  prefixTouched: false,
  touched: { name: false, prefix: false },
  confirmingDelete: false,
});

function NewListDialog({ lists }: { lists: TodoList[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, dispatch] = useReducer(listFormReducer, listForm());
  const { name, prefix, prefixTouched, touched } = form;

  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(name.trim()), 300);
    return () => clearTimeout(timer);
  }, [name]);
  const { data: suggestion } = useQuery<{ suggestListPrefix: string }>(SUGGEST_PREFIX_QUERY, {
    variables: { name: debounced },
    skip: !open || !debounced,
  });
  const shownPrefix = prefixTouched ? prefix : (suggestion?.suggestListPrefix ?? "");

  const result = todoListSchema(t, lists).safeParse({ name, prefix: shownPrefix });
  const errors = fieldErrors(result.error);

  const [createList, creating] = useMutation(CREATE_TODO_LIST_MUTATION, {
    refetchQueries: TODO_REFETCH,
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      dispatch({ type: "reset", state: listForm() });
      creating.reset();
    }
    setOpen(next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    dispatch({ type: "touchAll" });
    if (!result.success) return;
    const created = await createList({ variables: { input: result.data } }).catch(() => null);
    if (created) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> {t("todos.lists.newList")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("todos.lists.newList")}</DialogTitle>
          </DialogHeader>
          <ListFields
            name={name}
            prefix={shownPrefix}
            errors={errors}
            // A suggested prefix is checked straight away: it can't be "untouched" and wrong.
            touched={{ name: touched.name, prefix: touched.prefix || shownPrefix !== "" }}
            onName={(value) => dispatch({ type: "name", name: value })}
            onPrefix={(value) => dispatch({ type: "prefix", prefix: value })}
            hint={t("todos.lists.prefixHint", {
              example: `${shownPrefix || "GRO"}-1, ${shownPrefix || "GRO"}-2…`,
            })}
          />
          {creating.error && <p className="text-sm text-destructive">{creating.error.message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={creating.loading || !result.success}>
              {t("todos.lists.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditListForm({
  list,
  lists,
  onClose,
}: {
  list: TodoList;
  lists: TodoList[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [form, dispatch] = useReducer(listFormReducer, listForm(list.name, list.prefix));
  const { name, prefix, touched, confirmingDelete } = form;

  const result = todoListSchema(t, lists, list.id).safeParse({ name, prefix });
  const errors = fieldErrors(result.error);

  const [updateList, updating] = useMutation(UPDATE_TODO_LIST_MUTATION, {
    refetchQueries: TODO_REFETCH,
  });
  const [deleteList, deleting] = useMutation(DELETE_TODO_LIST_MUTATION, {
    refetchQueries: TODO_REFETCH,
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    dispatch({ type: "touchAll" });
    if (!result.success) return;
    const saved = await updateList({
      variables: {
        id: list.id,
        input: {
          name: list.isInbox ? undefined : result.data.name,
          prefix: result.data.prefix !== list.prefix ? result.data.prefix : undefined,
        },
      },
    }).catch(() => null);
    if (saved) onClose();
  }

  return (
    <DialogContent>
      <form onSubmit={save} noValidate className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("todos.lists.editList")}</DialogTitle>
        </DialogHeader>
        {list.isInbox ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="list-prefix">{t("todos.lists.prefix")}</Label>
            <Input
              id="list-prefix"
              className="w-32 font-mono uppercase"
              value={prefix}
              maxLength={6}
              aria-invalid={!!errors.prefix}
              onChange={(e) => dispatch({ type: "prefix", prefix: e.target.value.toUpperCase() })}
            />
            <p
              className={
                errors.prefix ? "text-xs text-destructive" : "text-xs text-muted-foreground"
              }
            >
              {errors.prefix ??
                (prefix !== list.prefix
                  ? t("todos.lists.renameHint", { from: `${list.prefix}-1`, to: `${prefix}-1` })
                  : t("todos.lists.prefixHint", { example: `${prefix}-1, ${prefix}-2…` }))}
            </p>
          </div>
        ) : (
          <ListFields
            name={name}
            prefix={prefix}
            errors={errors}
            // Editing starts from valid values, so show problems as soon as they appear.
            touched={{ name: touched.name || !!errors.name, prefix: true }}
            onName={(value) => dispatch({ type: "name", name: value })}
            onPrefix={(value) => dispatch({ type: "prefix", prefix: value })}
            hint={
              prefix !== list.prefix
                ? t("todos.lists.renameHint", { from: `${list.prefix}-1`, to: `${prefix}-1` })
                : t("todos.lists.prefixHint", { example: `${prefix}-1, ${prefix}-2…` })
            }
          />
        )}
        {updating.error && <p className="text-sm text-destructive">{updating.error.message}</p>}

        {confirmingDelete && (
          <ConfirmPrompt
            message={`${t("todos.lists.deletePrompt", {
              name: list.name,
              count: list.openCount + list.doneCount,
            })} ${t("todos.cannotUndo")}`}
            confirmLabel={t("todos.lists.delete")}
            busy={deleting.loading}
            onCancel={() => dispatch({ type: "confirmDelete", on: false })}
            onConfirm={async () => {
              await deleteList({ variables: { id: list.id } });
              onClose();
            }}
          />
        )}
        <DialogFooter className={confirmingDelete ? "hidden" : "sm:justify-between"}>
          {list.isInbox ? (
            <p className="text-xs text-muted-foreground sm:max-w-60">
              {t("todos.lists.inboxNoDelete")}
            </p>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => dispatch({ type: "confirmDelete", on: true })}
            >
              <Trash2 className="size-4" /> {t("todos.lists.delete")}
            </Button>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={updating.loading || !result.success}>
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
    <form onSubmit={go} className="flex flex-col gap-1">
      <div className="flex gap-1.5">
        <div className="relative">
          <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-3.5 text-muted-foreground" />
          <Input
            aria-label={t("todos.lists.findKey")}
            title={t("todos.lists.findKey")}
            className="w-36 pl-8 font-mono uppercase"
            placeholder={t("todos.lists.findPlaceholder")}
            value={key}
            onChange={(e) => {
              setKey(e.target.value.toUpperCase());
              setError(null);
            }}
          />
        </div>
        <Button type="submit" variant="outline" disabled={!key.trim()}>
          {t("todos.lists.go")}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <TaskDialog task={found} onClose={() => setFound(null)} />
    </form>
  );
}
