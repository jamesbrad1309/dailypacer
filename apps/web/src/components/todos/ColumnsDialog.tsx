import { useMutation } from "@apollo/client/react";
import { ArrowLeft, ArrowRight, Columns3, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmPrompt } from "#components/todos/ConfirmPrompt";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import {
  CREATE_TODO_COLUMN_MUTATION,
  DELETE_TODO_COLUMN_MUTATION,
  TODO_REFETCH,
  UPDATE_TODO_COLUMN_MUTATION,
} from "#graphql/todos";
import type { TaskStatus, TodoColumn, TodoList } from "#graphql/types";
import { columnName, positionBetween, TASK_STATUSES } from "#lib/todos";

const SELECT = "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm";
const MAX_COLUMNS = 10;

interface State {
  /** The new column form. */
  name: string;
  status: TaskStatus;
  /** The column whose delete is being confirmed, and where its tasks go. */
  deletingId: string | null;
  moveTo: string;
  error: string | null;
}

type Action =
  | { type: "setName"; name: string }
  | { type: "setStatus"; status: TaskStatus }
  | { type: "added" }
  | { type: "askDelete"; id: string; moveTo: string }
  | { type: "setMoveTo"; moveTo: string }
  | { type: "closeDelete" }
  | { type: "error"; message: string | null };

const initial: State = {
  name: "",
  status: "IN_PROGRESS",
  deletingId: null,
  moveTo: "",
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setName":
      return { ...state, name: action.name };
    case "setStatus":
      return { ...state, status: action.status };
    case "added":
      return { ...state, name: "", error: null };
    case "askDelete":
      return { ...state, deletingId: action.id, moveTo: action.moveTo, error: null };
    case "setMoveTo":
      return { ...state, moveTo: action.moveTo };
    case "closeDelete":
      return { ...state, deletingId: null, moveTo: "" };
    case "error":
      return { ...state, error: action.message };
  }
}

/**
 * Add, rename, reorder (← →), re-type and delete a list's board columns.
 * Each column counts as a status; the last column of a status can't be
 * deleted or re-typed, and deleting one with tasks asks where they go.
 * Changes apply straight away.
 */
export function ColumnsDialog({ list }: { list: TodoList }) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(reducer, initial);
  const columns = list.columns;
  const options = { refetchQueries: TODO_REFETCH, awaitRefetchQueries: true };
  const [createColumn, creating] = useMutation(CREATE_TODO_COLUMN_MUTATION, options);
  const [updateColumn] = useMutation(UPDATE_TODO_COLUMN_MUTATION, options);
  const [deleteColumn, deleting] = useMutation(DELETE_TODO_COLUMN_MUTATION, options);

  const onlyOfStatus = (column: TodoColumn) =>
    columns.filter((c) => c.status === column.status).length === 1;

  async function run(work: () => Promise<unknown>) {
    dispatch({ type: "error", message: null });
    await work().catch((e: Error) => dispatch({ type: "error", message: e.message }));
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!state.name.trim()) return;
    await run(async () => {
      await createColumn({
        variables: { listId: list.id, input: { name: state.name.trim(), status: state.status } },
      });
      dispatch({ type: "added" });
    });
  }

  function move(index: number, by: -1 | 1) {
    const to = index + by;
    // Between the two columns on the far side of the one it swaps with.
    const before = by === -1 ? columns[to - 1] : columns[to];
    const after = by === -1 ? columns[to] : columns[to + 1];
    return run(() =>
      updateColumn({
        variables: {
          id: columns[index].id,
          input: { position: positionBetween(before?.position ?? null, after?.position ?? null) },
        },
      }),
    );
  }

  const deletingColumn = columns.find((c) => c.id === state.deletingId);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="size-4" /> {t("todos.board.editColumns")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("todos.board.editColumns")}</DialogTitle>
          <DialogDescription>{t("todos.board.columnsHint")}</DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-2">
          {columns.map((column, index) => {
            const label = columnName(column, t);
            const locked = onlyOfStatus(column);
            return (
              <li key={column.id} className="flex flex-col gap-1.5 rounded-md border p-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Input
                    // Keyed by name so a save from elsewhere resets the draft.
                    key={`${column.id}:${column.name ?? ""}`}
                    aria-label={t("todos.board.rename", { name: label })}
                    defaultValue={column.name ?? ""}
                    placeholder={t(`todos.status.${column.status}`)}
                    maxLength={30}
                    className="h-8 min-w-32 flex-1"
                    onBlur={(e) => {
                      const name = e.target.value.trim() || null;
                      if (name !== column.name) {
                        run(() => updateColumn({ variables: { id: column.id, input: { name } } }));
                      }
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                  <select
                    aria-label={`${t("todos.board.countsAs")}: ${label}`}
                    className={SELECT}
                    value={column.status}
                    disabled={locked}
                    onChange={(e) =>
                      run(() =>
                        updateColumn({
                          variables: { id: column.id, input: { status: e.target.value } },
                        }),
                      )
                    }
                  >
                    {TASK_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {t(`todos.status.${status}`)}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label={t("todos.board.moveLeft", { name: label })}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label={t("todos.board.moveRight", { name: label })}
                    disabled={index === columns.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label={t("todos.board.deleteColumn", { name: label })}
                    disabled={locked}
                    onClick={() =>
                      dispatch({
                        type: "askDelete",
                        id: column.id,
                        moveTo: columns.find((c) => c.id !== column.id)?.id ?? "",
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {locked && (
                  <p className="px-1 text-xs text-muted-foreground">
                    {t("todos.board.lastOfStatus", {
                      status: t(`todos.status.${column.status}`),
                    })}
                  </p>
                )}
                {deletingColumn?.id === column.id && (
                  <ConfirmPrompt
                    message={
                      <>
                        {t("todos.board.deleteColumnPrompt", { name: label })}
                        {column.taskCount > 0 && (
                          <span className="mt-2 flex flex-wrap items-center gap-2">
                            {t("todos.board.deleteColumnMove", { count: column.taskCount })}
                            <select
                              aria-label={t("todos.board.deleteColumnMove", {
                                count: column.taskCount,
                              })}
                              className={SELECT}
                              value={state.moveTo}
                              onChange={(e) =>
                                dispatch({ type: "setMoveTo", moveTo: e.target.value })
                              }
                            >
                              {columns
                                .filter((c) => c.id !== column.id)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {columnName(c, t)}
                                  </option>
                                ))}
                            </select>
                          </span>
                        )}
                      </>
                    }
                    confirmLabel={t("todos.board.deleteColumn", { name: label })}
                    busy={deleting.loading}
                    onCancel={() => dispatch({ type: "closeDelete" })}
                    onConfirm={() =>
                      run(async () => {
                        await deleteColumn({
                          variables: {
                            id: column.id,
                            moveTo: column.taskCount > 0 ? state.moveTo : undefined,
                          },
                        });
                        dispatch({ type: "closeDelete" });
                      })
                    }
                  />
                )}
              </li>
            );
          })}
        </ol>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}

        {columns.length < MAX_COLUMNS ? (
          <form onSubmit={add} className="flex flex-wrap items-end gap-2 border-t pt-4">
            <div className="flex min-w-40 flex-1 flex-col gap-1.5">
              <Label htmlFor="column-name">{t("todos.board.columnName")}</Label>
              <Input
                id="column-name"
                value={state.name}
                maxLength={30}
                placeholder={t("todos.board.columnNamePlaceholder")}
                onChange={(e) => dispatch({ type: "setName", name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="column-status">{t("todos.board.countsAs")}</Label>
              <select
                id="column-status"
                className={SELECT}
                value={state.status}
                onChange={(e) =>
                  dispatch({ type: "setStatus", status: e.target.value as TaskStatus })
                }
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`todos.status.${status}`)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={creating.loading || !state.name.trim()}>
              <Plus className="size-4" /> {t("todos.board.addColumn")}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">{t("todos.board.maxColumns")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
