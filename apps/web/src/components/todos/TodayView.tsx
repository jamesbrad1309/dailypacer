import { useMutation, useQuery } from "@apollo/client/react";
import { Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListSkeleton } from "#components/layout/Skeletons";
import { TaskDialog } from "#components/todos/TaskDialog";
import { TaskRow } from "#components/todos/TaskRow";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { Progress } from "#components/ui/progress";
import {
  CREATE_TASK_MUTATION,
  TODAY_TASKS_QUERY,
  TODO_LISTS_QUERY,
  TODO_REFETCH,
  UPDATE_TASK_MUTATION,
} from "#graphql/todos";
import type { Task, TodayTasksData, TodoListsData } from "#graphql/types";
import { daysBetween, todayIsoDate } from "#lib/dates";
import { listName } from "#lib/todos";

/**
 * Today's plan from every list, and below it whatever was planned for an
 * earlier day and isn't done. Nothing carries over on its own: each earlier
 * task waits for "Move to today" or "Unplan".
 */
export function TodayView() {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const { data, loading, error } = useQuery<TodayTasksData>(TODAY_TASKS_QUERY, {
    variables: { today },
  });
  const { data: listsData } = useQuery<TodoListsData>(TODO_LISTS_QUERY);
  const lists = listsData?.todoLists ?? [];

  const [title, setTitle] = useState("");
  const [listId, setListId] = useState("");
  const [open, setOpen] = useState<Task | null>(null);

  const [createTask, creating] = useMutation(CREATE_TASK_MUTATION, {
    refetchQueries: TODO_REFETCH,
    awaitRefetchQueries: true,
  });
  const [updateTask] = useMutation(UPDATE_TASK_MUTATION, { refetchQueries: TODO_REFETCH });

  const update = (task: Task, input: Record<string, unknown>) =>
    updateTask({ variables: { id: task.id, input } });

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask({
      variables: {
        input: { title: title.trim(), listId: listId || undefined, plannedFor: today },
      },
    });
    setTitle("");
  }

  if (loading && !data) return <ListSkeleton rows={4} />;
  if (error) return <p className="text-destructive">{error.message}</p>;

  const planned = data?.todayTasks.today ?? [];
  const earlier = data?.todayTasks.earlier ?? [];
  const done = planned.filter((task) => task.status === "DONE").length;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <Input
          aria-label={t("todos.today.addPlaceholder")}
          placeholder={t("todos.today.addPlaceholder")}
          value={title}
          maxLength={300}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-48 flex-1"
        />
        <select
          aria-label={t("todos.today.addTo")}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          value={listId}
          onChange={(e) => setListId(e.target.value)}
        >
          {lists.map((list) => (
            <option key={list.id} value={list.isInbox ? "" : list.id}>
              {listName(list, t)} ({list.prefix})
            </option>
          ))}
        </select>
        <Button type="submit" disabled={creating.loading || !title.trim()}>
          <Plus className="size-4" /> {t("todos.today.add")}
        </Button>
      </form>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("todos.today.planned")}</h2>
          {planned.length > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {t("todos.today.doneCount", { done, total: planned.length })}
            </span>
          )}
        </div>
        {planned.length > 0 && (
          <Progress value={Math.round((done / planned.length) * 100)} className="h-1.5" />
        )}
        {planned.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t("todos.today.nothing")}
          </p>
        ) : (
          <div className="divide-y rounded-xl border bg-card">
            {planned.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => setOpen(task)}
                onToggle={(checked) => update(task, { status: checked ? "DONE" : "TODO" })}
              />
            ))}
          </div>
        )}
        {planned.length > 0 && done === planned.length && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {t("todos.today.allDone")}
          </p>
        )}
      </section>

      {earlier.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {t("todos.today.earlier")}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {earlier.length}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">{t("todos.today.earlierHint")}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                Promise.all(earlier.map((task) => update(task, { plannedFor: today })))
              }
            >
              {t("todos.today.moveAllToToday")}
            </Button>
          </div>
          <div className="divide-y rounded-xl border bg-card">
            {earlier.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => setOpen(task)}
                onToggle={(checked) => update(task, { status: checked ? "DONE" : "TODO" })}
                meta={
                  task.plannedFor && (
                    <span className="text-amber-700 dark:text-amber-400">
                      {t("todos.today.carried", {
                        count: daysBetween(task.plannedFor, today),
                      })}
                    </span>
                  )
                }
                actions={
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => update(task, { plannedFor: today })}
                    >
                      {t("todos.today.moveToToday")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => update(task, { plannedFor: null })}
                    >
                      {t("todos.today.unplan")}
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        </section>
      )}

      <TaskDialog task={open} onClose={() => setOpen(null)} />
    </div>
  );
}
