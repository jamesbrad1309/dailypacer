import { useMutation, useQuery } from "@apollo/client/react";
import { Lock, Trash2, X } from "lucide-react";
import { type FormEvent, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmPrompt } from "#components/todos/ConfirmPrompt";
import { TaskPicker } from "#components/todos/TaskPicker";
import { TaskKey } from "#components/todos/TaskRow";
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
import { Textarea } from "#components/ui/textarea";
import {
  ADD_TASK_DEPENDENCY_MUTATION,
  DELETE_TASK_MUTATION,
  REMOVE_TASK_DEPENDENCY_MUTATION,
  TODO_LISTS_QUERY,
  TODO_REFETCH,
  UPDATE_TASK_MUTATION,
} from "#graphql/todos";
import type { Task, TaskRef, TodoListsData } from "#graphql/types";
import { formatShortDate, todayIsoDate } from "#lib/dates";
import { columnName, listName } from "#lib/todos";
import { cn } from "#lib/utils";

const SELECT = "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm";

interface Props {
  /** The task to edit; null closes the dialog. */
  task: Task | null;
  onClose: () => void;
}

/**
 * Everything about one task: title, notes, list, column (which sets its
 * status), planned day, due date, and delete. Picking another list warns
 * that the key will change (the task takes that list's next number) and
 * offers that list's columns, starting at the first with the same status.
 */
export function TaskDialog({ task, onClose }: Props) {
  return (
    <Dialog open={task !== null} onOpenChange={(open) => !open && onClose()}>
      {/* Keyed so each task opens with its own values, not the last one's draft. */}
      {task && <TaskForm key={task.id} task={task} onClose={onClose} />}
    </Dialog>
  );
}

interface FormState {
  title: string;
  notes: string;
  listId: string;
  columnId: string;
  /** "YYYY-MM-DD" or "" for none, as the date inputs hold them. */
  plannedFor: string;
  dueOn: string;
  confirmingDelete: boolean;
}

type FormAction =
  | { [K in keyof FormState]: { type: "set"; field: K; value: FormState[K] } }[keyof FormState]
  | { type: "pickList"; listId: string; columnId: string };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "pickList":
      return { ...state, listId: action.listId, columnId: action.columnId };
  }
}

function TaskForm({ task, onClose }: { task: Task; onClose: () => void }) {
  const { t } = useTranslation();
  const [form, dispatch] = useReducer(formReducer, {
    title: task.title,
    notes: task.notes ?? "",
    listId: task.listId,
    columnId: task.columnId,
    plannedFor: task.plannedFor ?? "",
    dueOn: task.dueOn ?? "",
    confirmingDelete: false,
  });
  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    dispatch({ type: "set", field, value } as FormAction);
  const { title, notes, listId, columnId, plannedFor, dueOn, confirmingDelete } = form;

  const { data: listsData } = useQuery<TodoListsData>(TODO_LISTS_QUERY);
  const lists = listsData?.todoLists ?? [];
  const target = lists.find((list) => list.id === listId);
  const moving = listId !== task.listId && target;
  const columns = target?.columns ?? [];
  const status = columns.find((column) => column.id === columnId)?.status ?? task.status;

  function pickList(id: string) {
    const next = lists.find((list) => list.id === id)?.columns ?? [];
    const sameStatus = next.find((column) => column.status === status) ?? next[0];
    dispatch({
      type: "pickList",
      listId: id,
      columnId: id === task.listId ? task.columnId : (sameStatus?.id ?? ""),
    });
  }

  const [updateTask, updating] = useMutation(UPDATE_TASK_MUTATION, {
    refetchQueries: TODO_REFETCH,
  });
  const [deleteTask, deleting] = useMutation(DELETE_TASK_MUTATION, {
    refetchQueries: TODO_REFETCH,
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await updateTask({
      variables: {
        id: task.id,
        input: {
          title: title.trim(),
          notes: notes.trim() || null,
          columnId: columnId !== task.columnId ? columnId : undefined,
          plannedFor: plannedFor || null,
          dueOn: dueOn || null,
          listId: listId !== task.listId ? listId : undefined,
        },
      },
    });
    onClose();
  }

  return (
    <DialogContent>
      <form onSubmit={save} className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TaskKey taskKey={task.key} className="text-xs" />
            <span className="truncate">{task.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="task-title">{t("todos.task.title")}</Label>
          <Input
            id="task-title"
            value={title}
            maxLength={300}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="task-notes">{t("todos.task.notes")}</Label>
          <Textarea
            id="task-notes"
            rows={3}
            maxLength={5000}
            placeholder={t("todos.task.notesPlaceholder")}
            value={notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-list">{t("todos.task.list")}</Label>
            <select
              id="task-list"
              className={SELECT}
              value={listId}
              onChange={(e) => pickList(e.target.value)}
            >
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {listName(list, t)} ({list.prefix})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-column">{t("todos.task.column")}</Label>
            <select
              id="task-column"
              className={SELECT}
              value={columnId}
              onChange={(e) => set("columnId", e.target.value)}
            >
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name
                    ? `${column.name} (${t(`todos.status.${column.status}`)})`
                    : columnName(column, t)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {moving && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            {t("todos.task.moveWarning", {
              list: listName(target, t),
              from: task.key,
              to: `${target.prefix}-${target.nextNumber}`,
            })}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-planned">{t("todos.task.plannedFor")}</Label>
            <div className="flex gap-1.5">
              <Input
                id="task-planned"
                type="date"
                className="min-w-0 flex-1"
                aria-describedby="task-planned-hint"
                value={plannedFor}
                onChange={(e) => set("plannedFor", e.target.value)}
              />
              {plannedFor ? (
                <Button type="button" variant="ghost" onClick={() => set("plannedFor", "")}>
                  {t("todos.task.clear")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => set("plannedFor", todayIsoDate())}
                >
                  {t("todos.task.planToday")}
                </Button>
              )}
            </div>
            <p id="task-planned-hint" className="text-xs text-muted-foreground">
              {t("todos.task.plannedHint")}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-due">{t("todos.task.dueOn")}</Label>
            <div className="flex gap-1.5">
              <Input
                id="task-due"
                type="date"
                className="min-w-0 flex-1"
                aria-describedby="task-due-hint"
                value={dueOn}
                onChange={(e) => set("dueOn", e.target.value)}
              />
              {dueOn && (
                <Button type="button" variant="ghost" onClick={() => set("dueOn", "")}>
                  {t("todos.task.clear")}
                </Button>
              )}
            </div>
            <p id="task-due-hint" className="text-xs text-muted-foreground">
              {t("todos.task.dueHint")}
            </p>
          </div>
        </div>

        {status === "DONE" && task.blocked && (
          <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <Lock className="mt-0.5 size-3 shrink-0" />
            {t("todos.task.doneWhileBlocked", {
              keys: task.blockedBy
                .filter((dep) => dep.status !== "DONE")
                .map((dep) => dep.key)
                .join(", "),
            })}
          </p>
        )}

        <Dependencies task={task} />

        <p className="text-xs text-muted-foreground">
          {t("todos.task.created", { date: formatShortDate(task.createdAt.slice(0, 10)) })}
        </p>

        {confirmingDelete ? (
          <ConfirmPrompt
            message={
              <>
                {t("todos.task.deletePrompt", { key: task.key, title: task.title })}
                {task.blocks.length > 0 &&
                  ` ${t("todos.task.deleteUnblocks", {
                    count: task.blocks.length,
                    keys: task.blocks.map((dep) => dep.key).join(", "),
                  })}`}{" "}
                {t("todos.cannotUndo")}
              </>
            }
            confirmLabel={t("todos.task.delete")}
            busy={deleting.loading}
            onCancel={() => set("confirmingDelete", false)}
            onConfirm={async () => {
              await deleteTask({ variables: { id: task.id } });
              onClose();
            }}
          />
        ) : (
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => set("confirmingDelete", true)}>
              <Trash2 className="size-4" /> {t("todos.task.delete")}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={updating.loading || !title.trim()}>
                {t("todos.task.save")}
              </Button>
            </div>
          </DialogFooter>
        )}
      </form>
    </DialogContent>
  );
}

/**
 * What this task waits for (removable, and added by key from any list) and,
 * read-only, what waits for it. Changes apply straight away rather than on
 * Save, so a refused link (a loop) shows its reason at once.
 */
function Dependencies({ task }: { task: Task }) {
  const { t } = useTranslation();
  const [addDependency, adding] = useMutation(ADD_TASK_DEPENDENCY_MUTATION, {
    refetchQueries: TODO_REFETCH,
  });
  const [removeDependency] = useMutation(REMOVE_TASK_DEPENDENCY_MUTATION, {
    refetchQueries: TODO_REFETCH,
  });
  // The dialog shows the task as it was opened; this tracks links changed since.
  const [waitingFor, setWaitingFor] = useState<TaskRef[]>(task.blockedBy);

  async function add(dependsOn: Task) {
    const result = await addDependency({
      variables: { taskId: task.id, dependsOnKey: dependsOn.key },
    }).catch(() => null);
    const updated = (result?.data as { addTaskDependency?: Task } | undefined)?.addTaskDependency;
    if (updated) setWaitingFor(updated.blockedBy);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{t("todos.task.waitingFor")}</p>
        <p className="text-xs text-muted-foreground">{t("todos.task.waitingForHint")}</p>
      </div>
      {waitingFor.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("todos.task.noDependencies")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {waitingFor.map((dep) => (
            <DependencyItem
              key={dep.id}
              dep={dep}
              onRemove={async () => {
                setWaitingFor((current) => current.filter((d) => d.id !== dep.id));
                await removeDependency({ variables: { taskId: task.id, dependsOnId: dep.id } });
              }}
            />
          ))}
        </ul>
      )}
      <TaskPicker excludeDependenciesOf={task.id} onPick={add} disabled={adding.loading} />
      {adding.error && <p className="text-xs text-destructive">{adding.error.message}</p>}

      {task.blocks.length > 0 && (
        <div className="mt-1 flex flex-col gap-1 border-t pt-2">
          <p className="text-sm font-medium">{t("todos.task.blocks")}</p>
          <ul className="flex flex-col gap-1">
            {task.blocks.map((dep) => (
              <DependencyItem key={dep.id} dep={dep} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DependencyItem({ dep, onRemove }: { dep: TaskRef; onRemove?: () => void }) {
  const { t } = useTranslation();
  const done = dep.status === "DONE";
  return (
    <li className="flex items-center gap-2 text-sm">
      <TaskKey taskKey={dep.key} />
      <span className={cn("min-w-0 flex-1 truncate", done && "text-muted-foreground line-through")}>
        {dep.title}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {t(`todos.status.${dep.status}`)}
      </span>
      {onRemove && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-6"
          aria-label={t("todos.task.removeDependency", { key: dep.key })}
          onClick={onRemove}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </li>
  );
}
