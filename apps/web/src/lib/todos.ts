import type { TFunction } from "i18next";
import type { TodoList } from "#graphql/types";

/** Same rule as the API: a letter, then 1–5 letters or digits. */
export const PREFIX_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/;

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;

/** A board position between two neighbours, as the API's positionBetween. */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return (after as number) - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}

/** The Inbox's name is stored in English; show it in the UI language. */
export function listName(list: Pick<TodoList, "name" | "isInbox">, t: TFunction): string {
  return list.isInbox ? t("todos.inbox") : list.name;
}
