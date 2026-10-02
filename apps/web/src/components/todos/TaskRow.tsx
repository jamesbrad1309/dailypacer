import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "#components/ui/checkbox";
import type { Task } from "#graphql/types";
import { listName } from "#lib/todos";
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
}

/** One task in a list: tick it off, or click the title to open it. */
export function TaskRow({ task, onToggle, onOpen, showList = true, actions, meta }: Props) {
  const { t } = useTranslation();
  const done = task.status === "DONE";
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
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
