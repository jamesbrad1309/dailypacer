import { useQuery } from "@apollo/client/react";
import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { TaskKey } from "#components/todos/TaskRow";
import { Input } from "#components/ui/input";
import { SEARCH_TASKS_QUERY } from "#graphql/todos";
import type { Task } from "#graphql/types";
import { listName } from "#lib/todos";
import { cn } from "#lib/utils";

interface Props {
  /** Leave out this task and what it already waits for. */
  excludeDependenciesOf?: string;
  onPick: (task: Task) => void;
  disabled?: boolean;
}

/**
 * Autocomplete over every list's tasks, by title, key (HOME-2) or number.
 * An ARIA combobox: ↑/↓ move through results, Enter picks, Escape closes the
 * results (and only then the dialog around it).
 */
export function TaskPicker({ excludeDependenciesOf, onPick, disabled }: Props) {
  const { t } = useTranslation();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, previousData, loading } = useQuery<{ searchTasks: Task[] }>(SEARCH_TASKS_QUERY, {
    variables: { query: debounced, excludeDependenciesOf },
    skip: !debounced,
    fetchPolicy: "network-only",
  });
  const results = debounced ? ((data ?? previousData)?.searchTasks ?? []) : [];
  const showList = open && debounced !== "";
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  function pick(task: Task) {
    onPick(task);
    setQuery("");
    setDebounced("");
    setOpen(false);
    setActive(0);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (results.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + results.length) % results.length);
    } else if (e.key === "Enter") {
      // Pick the highlighted result; never submit the form around the picker.
      e.preventDefault();
      if (showList && results[activeIndex]) pick(results[activeIndex]);
    } else if (e.key === "Escape" && showList) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && results[activeIndex] ? `${listboxId}-${results[activeIndex].id}` : undefined
        }
        aria-label={t("todos.task.searchPlaceholder")}
        placeholder={t("todos.task.searchPlaceholder")}
        className="h-8"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        // Delay so a click on a result lands before the list closes.
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      <span className="sr-only" aria-live="polite">
        {showList && !loading ? t("todos.task.searchResults", { count: results.length }) : ""}
      </span>
      {showList && (
        // Focus stays in the input (aria-activedescendant), per the ARIA
        // combobox pattern, so the listbox is deliberately not focusable.
        // biome-ignore lint/a11y/useFocusableInteractive: see above
        <div
          id={listboxId}
          // biome-ignore lint/a11y/useSemanticElements: a <select> can't show search results under an input
          role="listbox"
          aria-label={t("todos.task.waitingFor")}
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {results.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {loading ? t("todos.task.searching") : t("todos.task.searchEmpty")}
            </p>
          ) : (
            results.map((task, index) => (
              <div
                key={task.id}
                id={`${listboxId}-${task.id}`}
                // biome-ignore lint/a11y/useSemanticElements: option of the custom listbox above
                role="option"
                aria-selected={index === activeIndex}
                tabIndex={-1}
                // mousedown, not click: keep focus in the input.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(task);
                }}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm",
                  index === activeIndex && "bg-accent",
                )}
              >
                <TaskKey taskKey={task.key} />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    task.status === "DONE" && "text-muted-foreground line-through",
                  )}
                >
                  {task.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {listName(task.list, t)} · {t(`todos.status.${task.status}`)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
