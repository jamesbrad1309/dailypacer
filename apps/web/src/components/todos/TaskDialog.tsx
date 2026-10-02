import { useMutation, useQuery } from "@apollo/client/react";
import { Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
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
  DELETE_TASK_MUTATION,
  TODO_LISTS_QUERY,
  TODO_REFETCH,
  UPDATE_TASK_MUTATION,
} from "#graphql/todos";
import type { Task, TaskStatus, TodoListsData } from "#graphql/types";
import { formatShortDate, todayIsoDate } from "#lib/dates";
import { TASK_STATUSES, listName } from "#lib/todos";

const SELECT = "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm";

interface Props {
  /** The task to edit; null closes the dialog. */
  task: Task | null;
  onClose: () => void;
}

/**
 * Everything about one task: title, notes, list, status and planned day,
 * and delete. Picking another list warns that the key will change (the
 * task takes that list's next number).
 */
export function TaskDialog({ task, onClose }: Props) {
  return (
    <Dialog open={task !== null} onOpenChange={(open) => !open && onClose()}>
      {/* Keyed so each task opens with its own values, not the last one's draft. */}
      {task && <TaskForm key={task.id} task={task} onClose={onClose} />}
    </Dialog>
  );
}

function TaskForm({ task, onClose }: { task: Task; onClose: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [listId, setListId] = useState(task.listId);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [plannedFor, setPlannedFor] = useState(task.plannedFor ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: listsData } = useQuery<TodoListsData>(TODO_LISTS_QUERY);
  const lists = listsData?.todoLists ?? [];
  const target = lists.find((list) => list.id === listId);
  const moving = listId !== task.listId && target;

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
          status: status !== task.status ? status : undefined,
          plannedFor: plannedFor || null,
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
            onChange={(e) => setTitle(e.target.value)}
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
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-list">{t("todos.task.list")}</Label>
            <select
              id="task-list"
              className={SELECT}
              value={listId}
              onChange={(e) => setListId(e.target.value)}
            >
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {listName(list, t)} ({list.prefix})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-status">{t("todos.task.status")}</Label>
            <select
              id="task-status"
              className={SELECT}
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {TASK_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {t(`todos.status.${value}`)}
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="task-planned">{t("todos.task.plannedFor")}</Label>
          <div className="flex gap-2">
            <Input
              id="task-planned"
              type="date"
              className="flex-1"
              value={plannedFor}
              onChange={(e) => setPlannedFor(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={() => setPlannedFor(todayIsoDate())}>
              {t("todos.task.planToday")}
            </Button>
            {plannedFor && (
              <Button type="button" variant="ghost" onClick={() => setPlannedFor("")}>
                {t("todos.task.clear")}
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("todos.task.created", { date: formatShortDate(task.createdAt.slice(0, 10)) })}
        </p>

        <DialogFooter className="sm:justify-between">
          {confirmingDelete ? (
            <Button
              type="button"
              variant="destructive"
              disabled={deleting.loading}
              onClick={async () => {
                await deleteTask({ variables: { id: task.id } });
                onClose();
              }}
            >
              <Trash2 className="size-4" /> {t("todos.task.confirmDelete")}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="size-4" /> {t("todos.task.delete")}
            </Button>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={updating.loading || !title.trim()}>
              {t("todos.task.save")}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
