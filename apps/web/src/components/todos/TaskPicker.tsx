import { useQuery } from "@apollo/client/react";
import { type KeyboardEvent, useEffect, useId, useReducer } from "react";
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
interface PickerState {
  /** As typed. */
  query: string;
  /** The query once typing pauses: what's searched. */
  debounced: string;
  open: boolean;
  /** The highlighted result. */
  active: number;
}

type PickerAction =
  | { type: "type"; query: string }
  | { type: "settle"; query: string }
  | { type: "open"; on: boolean }
  /** Arrow keys or the mouse: highlight a result (and open the list). */
  | { type: "highlight"; index: number }
  | { type: "reset" };

const CLOSED: PickerState = { query: "", debounced: "", open: false, active: 0 };

function pickerReducer(state: PickerState, action: PickerAction): PickerState {
  switch (action.type) {
    case "type":
      return { ...state, query: action.query, open: true, active: 0 };
    case "settle":
      return { ...state, debounced: action.query };
    case "open":
      return { ...state, open: action.on };
    case "highlight":
      return { ...state, open: true, active: action.index };
    case "reset":
      return CLOSED;
  }
}

export function TaskPicker({ excludeDependenciesOf, onPick, disabled }: Props) {
  const { t } = useTranslation();
  const listboxId = useId();
  const [state, dispatch] = useReducer(pickerReducer, CLOSED);
  const { query, debounced, open, active } = state;

  useEffect(() => {
    const timer = setTimeout(() => dispatch({ type: "settle", query: query.trim() }), 200);
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
    dispatch({ type: "reset" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      dispatch({
        type: "highlight",
        index: results.length === 0 ? 0 : (activeIndex + step + results.length) % results.length,
      });
    } else if (e.key === "Enter") {
      // Pick the highlighted result; never submit the form around the picker.
      e.preventDefault();
      if (showList && results[activeIndex]) pick(results[activeIndex]);
    } else if (e.key === "Escape" && showList) {
      e.preventDefault();
      e.stopPropagation();
      dispatch({ type: "open", on: false });
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
          dispatch({ type: "type", query: e.target.value });
        }}
        onFocus={() => dispatch({ type: "open", on: true })}
        // Delay so a click on a result lands before the list closes.
        onBlur={() => setTimeout(() => dispatch({ type: "open", on: false }), 120)}
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
                onMouseEnter={() => dispatch({ type: "highlight", index })}
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
