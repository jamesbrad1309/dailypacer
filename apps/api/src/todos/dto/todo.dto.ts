import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
const status = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
const prefix = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,5}$/, "prefix must be a letter then 1–5 letters or digits");

export const createListSchema = z.object({
  name: z.string().trim().min(1).max(60),
  /** Suggested from the name when left out. */
  prefix: prefix.optional(),
});
export type CreateListInput = z.infer<typeof createListSchema>;

export const updateListSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  prefix: prefix.optional(),
  position: z.number().finite().optional(),
});
export type UpdateListInput = z.infer<typeof updateListSchema>;

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  notes: z.string().trim().max(5000).nullable().optional(),
  /** The Inbox when left out. */
  listId: z.string().uuid().optional(),
  plannedFor: day.nullable().optional(),
  status: status.optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/** Only the fields sent change; `null` clears notes or the planned day. */
export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  plannedFor: day.nullable().optional(),
  status: status.optional(),
  /** Board order within its column; sent by a drag. */
  position: z.number().finite().optional(),
  /** Moving lists gives the task the new list's next number. */
  listId: z.string().uuid().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const todayQuerySchema = z.object({ today: day });
export const listTasksQuerySchema = z.object({
  /** Done tasks shown on a board: the most recently completed ones. */
  doneLimit: z.coerce.number().int().min(0).max(200).default(50),
});
