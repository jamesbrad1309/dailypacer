import type { TFunction } from "i18next";
import { z } from "zod";
import type { TaskStatus, TodoList } from "#graphql/types";

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

/** A column's name, or its status's translated name when it has none. */
export function columnName(column: { name: string | null; status: TaskStatus }, t: TFunction) {
  return column.name ?? t(`todos.status.${column.status}`);
}

/**
 * How a due date reads next to a task: overdue, due today, due within the
 * next few days, or later. Done tasks are never overdue.
 */
export type DueState = "overdue" | "today" | "soon" | "later";
export function dueState(dueOn: string, today: string, soonDays = 3): DueState {
  if (dueOn < today) return "overdue";
  if (dueOn === today) return "today";
  const soon = new Date(`${today}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + soonDays);
  return dueOn <= soon.toISOString().slice(0, 10) ? "soon" : "later";
}

/** The Inbox's name is stored in English; show it in the UI language. */
export function listName(list: Pick<TodoList, "name" | "isInbox">, t: TFunction): string {
  return list.isInbox ? t("todos.inbox") : list.name;
}

/**
 * The create/edit list form: a name, and a prefix in the API's format that
 * no other list uses yet. The API enforces the same rules (a taken prefix is
 * a 409); checking here names the clashing list before anything is sent.
 * `existing` is the user's lists; `selfId` is the list being edited, whose
 * own prefix doesn't count as taken.
 */
export function todoListSchema(
  t: TFunction,
  existing: readonly Pick<TodoList, "id" | "name" | "prefix" | "isInbox">[],
  selfId?: string,
) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t("todos.lists.nameRequired"))
      .max(60, t("todos.lists.nameTooLong")),
    prefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(PREFIX_PATTERN, t("todos.lists.prefixInvalid"))
      .superRefine((prefix, ctx) => {
        const owner = existing.find((list) => list.prefix === prefix && list.id !== selfId);
        if (owner) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("todos.lists.prefixTaken", { prefix, list: listName(owner, t) }),
          });
        }
      }),
  });
}
export type TodoListForm = z.infer<ReturnType<typeof todoListSchema>>;

/** The first error message per field, from a failed parse; empty when valid. */
export function fieldErrors(error: z.ZodError | undefined): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  for (const issue of error?.issues ?? []) {
    const field = String(issue.path[0]);
    errors[field] ??= issue.message;
  }
  return errors;
}
