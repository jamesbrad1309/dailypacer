import { useMutation, useQuery } from "@apollo/client/react";
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListSkeleton } from "#components/layout/Skeletons";
import { TaskDialog } from "#components/todos/TaskDialog";
import { BlockedBadge, TaskKey } from "#components/todos/TaskRow";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import {
  CREATE_TASK_MUTATION,
  LIST_BOARD_QUERY,
  TODO_REFETCH,
  UPDATE_TASK_MUTATION,
} from "#graphql/todos";
import type { ListBoardData, Task, TaskStatus } from "#graphql/types";
import { formatShortDate, todayIsoDate } from "#lib/dates";
import { TASK_STATUSES, listName, positionBetween } from "#lib/todos";
import { cn } from "#lib/utils";

const DONE_LIMIT = 50;

type Columns = Record<TaskStatus, string[]>;

function columnsOf(tasks: Task[]): Columns {
  const columns: Columns = { TODO: [], IN_PROGRESS: [], DONE: [] };
  // The API sends open tasks by position and done ones newest first.
  for (const task of tasks) columns[task.status].push(task.id);
  return columns;
}

function columnOf(columns: Columns, id: string): TaskStatus | undefined {
  if ((TASK_STATUSES as readonly string[]).includes(id)) return id as TaskStatus;
  return TASK_STATUSES.find((status) => columns[status].includes(id));
}

/**
 * A list's kanban board: To do, In progress, Done. Dragging a card (mouse,
 * touch, or Space + arrow keys) updates just that task: its status and a
 * position between its new neighbours. Done shows the latest completions.
 */
export function BoardView({ listId }: { listId: string }) {
  const { t } = useTranslation();
  const { data, loading, error } = useQuery<ListBoardData>(LIST_BOARD_QUERY, {
    variables: { listId, doneLimit: DONE_LIMIT },
  });
  const [updateTask] = useMutation(UPDATE_TASK_MUTATION, { refetchQueries: TODO_REFETCH });

  // While dragging, the board shows `dragColumns` (moved optimistically);
  // otherwise it shows the server's order.
  const [dragColumns, setDragColumns] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState<Task | null>(null);

  const sensors = useSensors(
    // A few pixels of movement before a drag starts, so a click still opens the card.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (loading && !data) return <ListSkeleton rows={4} />;
  if (error || !data) return <p className="text-destructive">{error?.message}</p>;

  const { list, tasks, doneTotal } = data.listBoard;
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const columns = dragColumns ?? columnsOf(tasks);
  const active = activeId ? byId.get(activeId) : undefined;

  function onDragStart({ active: dragged }: DragStartEvent) {
    setActiveId(String(dragged.id));
    setDragColumns(columnsOf(tasks));
  }

  function onDragOver({ active: dragged, over }: DragOverEvent) {
    if (!over || !dragColumns) return;
    const from = columnOf(dragColumns, String(dragged.id));
    const to = columnOf(dragColumns, String(over.id));
    if (!from || !to || from === to) return;
    // Crossing into another column: move the card there, at the hovered card's index.
    const target = dragColumns[to];
    const overIndex = target.indexOf(String(over.id));
    const index = overIndex === -1 ? target.length : overIndex;
    setDragColumns({
      ...dragColumns,
      [from]: dragColumns[from].filter((id) => id !== dragged.id),
      [to]: [...target.slice(0, index), String(dragged.id), ...target.slice(index)],
    });
  }

  async function onDragEnd({ active: dragged, over }: DragEndEvent) {
    const id = String(dragged.id);
    const task = byId.get(id);
    const working = dragColumns;
    setActiveId(null);
    if (!over || !task || !working) {
      setDragColumns(null);
      return;
    }
    const status = columnOf(working, id) as TaskStatus;
    let column = working[status];
    const overIndex = column.indexOf(String(over.id));
    if (overIndex !== -1 && overIndex !== column.indexOf(id)) {
      column = arrayMove(column, column.indexOf(id), overIndex);
    }
    const final = { ...working, [status]: column };
    setDragColumns(final);

    const index = column.indexOf(id);
    const statusChanged = status !== task.status;
    // Done is ordered by completion time, so a position there means nothing.
    const position =
      status === "DONE"
        ? undefined
        : positionBetween(
            index > 0 ? (byId.get(column[index - 1])?.position ?? null) : null,
            index < column.length - 1 ? (byId.get(column[index + 1])?.position ?? null) : null,
          );
    if (!statusChanged && (status === "DONE" || index === columnsOf(tasks)[status].indexOf(id))) {
      setDragColumns(null);
      return;
    }
    await updateTask({
      variables: {
        id,
        input: { status: statusChanged ? status : undefined, position },
      },
      awaitRefetchQueries: true,
    });
    setDragColumns(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/tasks/lists"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t("todos.board.back")}
      </Link>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">{listName(list, t)}</h2>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{list.prefix}</span>
        <span className="text-sm text-muted-foreground">
          {t("todos.lists.open", { count: list.openCount })} ·{" "}
          {t("todos.lists.done", { count: list.doneCount })}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t("todos.board.dragHint")}</p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setDragColumns(null);
        }}
      >
        <div className="grid items-start gap-4 md:grid-cols-3">
          {TASK_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              ids={columns[status]}
              byId={byId}
              listId={list.id}
              onOpen={setOpen}
              footer={
                status === "DONE" && doneTotal > columns.DONE.length ? (
                  <p className="px-1 text-xs text-muted-foreground">
                    {t("todos.board.doneShown", { shown: columns.DONE.length, total: doneTotal })}
                  </p>
                ) : null
              }
            />
          ))}
        </div>
        <DragOverlay>{active ? <Card task={active} dragging /> : null}</DragOverlay>
      </DndContext>

      <TaskDialog task={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Column({
  status,
  ids,
  byId,
  listId,
  onOpen,
  footer,
}: {
  status: TaskStatus;
  ids: string[];
  byId: Map<string, Task>;
  listId: string;
  onOpen: (task: Task) => void;
  footer: React.ReactNode;
}) {
  const { t } = useTranslation();
  // The column itself is a drop target, so an empty column still accepts cards.
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={t(`todos.status.${status}`)}
      className={cn(
        "flex min-h-40 flex-col gap-2 rounded-xl border bg-muted/30 p-2 transition-colors",
        isOver && "bg-accent/60",
      )}
    >
      <h3 className="flex items-center justify-between px-1 pt-1 text-sm font-medium">
        {t(`todos.status.${status}`)}
        <span className="text-xs font-normal text-muted-foreground tabular-nums">{ids.length}</span>
      </h3>
      {status === "TODO" && <AddTask listId={listId} />}
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {ids.map((id) => {
          const task = byId.get(id);
          return task ? <SortableCard key={id} task={task} onOpen={() => onOpen(task)} /> : null;
        })}
      </SortableContext>
      {ids.length === 0 && (
        <p className="px-1 py-4 text-center text-xs text-muted-foreground">
          {t("todos.board.empty")}
        </p>
      )}
      {footer}
    </section>
  );
}

function SortableCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <Card task={task} onOpen={onOpen} />
    </div>
  );
}

function Card({ task, onOpen, dragging }: { task: Task; onOpen?: () => void; dragging?: boolean }) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  return (
    <div
      className={cn(
        "flex cursor-grab flex-col gap-1.5 rounded-lg border bg-card p-3 text-sm shadow-sm",
        dragging && "cursor-grabbing shadow-lg ring-2 ring-primary/30",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        // Keyboard users pick the card up with Space on the wrapper; Enter opens it.
        className={cn(
          "text-left hover:underline",
          task.status === "DONE" && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <TaskKey taskKey={task.key} />
        <BlockedBadge task={task} />
        {task.plannedFor && (
          <span
            className={cn(
              "flex items-center gap-1 text-[11px] text-muted-foreground",
              task.plannedFor < today &&
                task.status !== "DONE" &&
                "text-amber-700 dark:text-amber-400",
            )}
          >
            <CalendarDays className="size-3" />
            {task.plannedFor === today
              ? t("todos.task.planToday")
              : formatShortDate(task.plannedFor)}
          </span>
        )}
      </div>
    </div>
  );
}

function AddTask({ listId }: { listId: string }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [createTask, creating] = useMutation(CREATE_TASK_MUTATION, {
    refetchQueries: TODO_REFETCH,
    awaitRefetchQueries: true,
  });
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask({ variables: { input: { title: title.trim(), listId } } });
    setTitle("");
  }
  return (
    <form onSubmit={add} className="flex gap-1.5">
      <Input
        aria-label={t("todos.board.add")}
        placeholder={t("todos.board.addPlaceholder")}
        value={title}
        maxLength={300}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8 bg-card text-sm"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        aria-label={t("todos.board.add")}
        disabled={creating.loading || !title.trim()}
      >
        <Plus className="size-4" />
      </Button>
    </form>
  );
}
