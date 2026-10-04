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
import { ColumnsDialog } from "#components/todos/ColumnsDialog";
import { TaskDialog } from "#components/todos/TaskDialog";
import { BlockedBadge, DueBadge, TaskKey } from "#components/todos/TaskRow";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import {
  CREATE_TASK_MUTATION,
  LIST_BOARD_QUERY,
  TODO_REFETCH,
  UPDATE_TASK_MUTATION,
} from "#graphql/todos";
import type { ListBoardData, Task, TodoColumn } from "#graphql/types";
import { formatShortDate, todayIsoDate } from "#lib/dates";
import { columnName, listName, positionBetween } from "#lib/todos";
import { cn } from "#lib/utils";

const DONE_LIMIT = 50;

/** Task ids per column id, in the order shown. */
type Columns = Record<string, string[]>;

function columnsOf(columns: TodoColumn[], tasks: Task[]): Columns {
  const result: Columns = Object.fromEntries(columns.map((column) => [column.id, []]));
  // The API sends open tasks by position and done ones newest first.
  for (const task of tasks) result[task.columnId]?.push(task.id);
  return result;
}

/** The column an id is (a column dropped on directly) or holds (a card). */
function columnOf(columns: Columns, id: string): string | undefined {
  if (id in columns) return id;
  return Object.keys(columns).find((column) => columns[column].includes(id));
}

/**
 * A list's kanban board, with the list's own columns (Edit columns adds,
 * renames, reorders and deletes them). Dragging a card (mouse, touch, or
 * Space + arrow keys) updates just that task: its column (and so its
 * status) and a position between its new neighbours. Done columns are
 * ordered by completion and show the latest completions.
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
  const columnById = new Map(list.columns.map((column) => [column.id, column]));
  const serverColumns = columnsOf(list.columns, tasks);
  const columns = dragColumns ?? serverColumns;
  const active = activeId ? byId.get(activeId) : undefined;
  const doneShown = tasks.filter((task) => task.status === "DONE").length;

  function onDragStart({ active: dragged }: DragStartEvent) {
    setActiveId(String(dragged.id));
    setDragColumns(serverColumns);
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
    const columnId = columnOf(working, id) as string;
    const isDone = columnById.get(columnId)?.status === "DONE";
    let column = working[columnId];
    const overIndex = column.indexOf(String(over.id));
    if (overIndex !== -1 && overIndex !== column.indexOf(id)) {
      column = arrayMove(column, column.indexOf(id), overIndex);
    }
    setDragColumns({ ...working, [columnId]: column });

    const index = column.indexOf(id);
    const columnChanged = columnId !== task.columnId;
    // Done columns are ordered by completion time, so a position there means nothing.
    const position = isDone
      ? undefined
      : positionBetween(
          index > 0 ? (byId.get(column[index - 1])?.position ?? null) : null,
          index < column.length - 1 ? (byId.get(column[index + 1])?.position ?? null) : null,
        );
    if (!columnChanged && (isDone || index === serverColumns[columnId].indexOf(id))) {
      setDragColumns(null);
      return;
    }
    await updateTask({
      variables: {
        id,
        input: { columnId: columnChanged ? columnId : undefined, position },
      },
      awaitRefetchQueries: true,
    }).finally(() => setDragColumns(null));
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
        <div className="ml-auto">
          <ColumnsDialog list={list} />
        </div>
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
        {/* Scrolls sideways when there are more columns than fit. */}
        <div className="-mx-1 flex items-start gap-4 overflow-x-auto px-1 pb-2">
          {list.columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              ids={columns[column.id] ?? []}
              byId={byId}
              listId={list.id}
              onOpen={setOpen}
            />
          ))}
        </div>
        {doneTotal > doneShown && (
          <p className="text-xs text-muted-foreground">
            {t("todos.board.doneShown", { shown: doneShown, total: doneTotal })}
          </p>
        )}
        <DragOverlay>{active ? <Card task={active} dragging /> : null}</DragOverlay>
      </DndContext>

      <TaskDialog task={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Column({
  column,
  ids,
  byId,
  listId,
  onOpen,
}: {
  column: TodoColumn;
  ids: string[];
  byId: Map<string, Task>;
  listId: string;
  onOpen: (task: Task) => void;
}) {
  const { t } = useTranslation();
  // The column itself is a drop target, so an empty column still accepts cards.
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const name = columnName(column, t);
  return (
    <section
      ref={setNodeRef}
      aria-label={name}
      className={cn(
        "flex min-h-40 w-72 shrink-0 flex-col gap-2 rounded-xl border bg-muted/30 p-2 transition-colors",
        isOver && "bg-accent/60",
      )}
    >
      <h3 className="flex items-center justify-between gap-2 px-1 pt-1 text-sm font-medium">
        <span className="truncate">{name}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-normal text-muted-foreground">
          {column.name && <span>{t(`todos.status.${column.status}`)}</span>}
          <span className="tabular-nums">{ids.length}</span>
        </span>
      </h3>
      {column.status === "TODO" && <AddTask listId={listId} columnId={column.id} />}
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
        <DueBadge task={task} />
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

function AddTask({ listId, columnId }: { listId: string; columnId: string }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [createTask, creating] = useMutation(CREATE_TASK_MUTATION, {
    refetchQueries: TODO_REFETCH,
    awaitRefetchQueries: true,
  });
  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask({ variables: { input: { title: title.trim(), listId, columnId } } });
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
