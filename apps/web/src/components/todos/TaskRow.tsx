import { Flag, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "#components/ui/checkbox";
import type { Task } from "#graphql/types";
import { daysBetween, formatShortDate, todayIsoDate } from "#lib/dates";
import { dueState, listName } from "#lib/todos";
import { cn } from "#lib/utils";

/** The task's key, e.g. GRO-12, in a fixed-width chip so a column of them lines up. */
export function TaskKey({ taskKey, className }: { taskKey: string; className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      {taskKey}
    </span>
  );
}

/**
 * "Blocked by GRO-3" (+n more) while a task waits for unfinished ones; the
 * lock and the words carry it, not colour alone. Nothing when it isn't blocked.
 */
export function BlockedBadge({ task }: { task: Pick<Task, "blocked" | "blockedBy"> }) {
  const { t } = useTranslation();
  if (!task.blocked) return null;
  const open = task.blockedBy.filter((dep) => dep.status !== "DONE");
  return (
    <span
      title={open.map((dep) => `${dep.key} ${dep.title}`).join("\n")}
      className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/15 px-1.5 text-[11px] text-amber-800 dark:text-amber-300"
    >
      <Lock className="size-3" />
      {open.length > 1
        ? t("todos.task.blockedByMore", { key: open[0].key, count: open.length - 1 })
        : t("todos.task.blockedBy", { key: open[0].key })}
    </span>
  );
}

/**
 * "Due Fri 9 Oct" / "Due today" / "Overdue by 2 days": the deadline, which
 * is separate from the day it's planned for. The flag and words carry the
 * urgency, colour only adds to it. Nothing for done tasks or without one.
 */
export function DueBadge({ task }: { task: Pick<Task, "dueOn" | "status"> }) {
  const { t } = useTranslation();
  if (!task.dueOn || task.status === "DONE") return null;
  const today = todayIsoDate();
  const state = dueState(task.dueOn, today);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded px-1.5 text-[11px]",
        state === "overdue" && "bg-destructive/15 text-destructive",
        state === "today" && "bg-amber-500/15 text-amber-800 dark:text-amber-300",
        (state === "soon" || state === "later") && "bg-muted text-muted-foreground",
      )}
    >
      <Flag className="size-3" />
      {state === "overdue"
        ? t("todos.task.due.overdue", { count: daysBetween(task.dueOn, today) })
        : t(`todos.task.due.${state}`, { date: formatShortDate(task.dueOn) })}
    </span>
  );
}

interface Props {
  task: Task;
  onToggle: (done: boolean) => void;
  onOpen: () => void;
  /** Hide the list name (on a list's own board, it's the same for every task). */
  showList?: boolean;
  /** Extra controls on the right, e.g. "Move to today". */
  actions?: ReactNode;
  /** A muted line under the title, e.g. "planned 3 days ago". */
  meta?: ReactNode;
  /** A drag handle before the checkbox (Today's reordering). */
  handle?: ReactNode;
}

/** One task in a list: tick it off, or click the title to open it. */
export function TaskRow({ task, onToggle, onOpen, showList = true, actions, meta, handle }: Props) {
  const { t } = useTranslation();
  const done = task.status === "DONE";
  return (
    <div className={cn("flex items-start gap-3 py-2.5 pr-4", handle ? "pl-1.5" : "pl-4")}>
      {handle}
      <Checkbox
        className="mt-0.5"
        checked={done}
        aria-label={task.title}
        onCheckedChange={(checked) => onToggle(checked === true)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "flex min-w-0 items-center gap-2 text-left text-sm hover:underline",
            done && "text-muted-foreground line-through",
          )}
        >
          <TaskKey taskKey={task.key} />
          <span className="truncate">{task.title}</span>
          <BlockedBadge task={task} />
          <DueBadge task={task} />
          {task.status === "IN_PROGRESS" && (
            <span className="shrink-0 rounded bg-sky-500/15 px-1.5 text-[11px] text-sky-700 dark:text-sky-400">
              {t("todos.status.IN_PROGRESS")}
            </span>
          )}
        </button>
        {(showList || meta) && (
          <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            {showList && <span>{listName(task.list, t)}</span>}
            {meta}
          </span>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
