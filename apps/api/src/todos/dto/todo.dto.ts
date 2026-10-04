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
  dueOn: day.nullable().optional(),
  status: status.optional(),
  /** A column of the list (its status follows); the first column of `status` when left out. */
  columnId: z.string().uuid().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/** Only the fields sent change; `null` clears notes or the planned day. */
export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  plannedFor: day.nullable().optional(),
  dueOn: day.nullable().optional(),
  /** Moves it to the first column of that status in its list. */
  status: status.optional(),
  /** A column of its (new) list; the status becomes the column's. */
  columnId: z.string().uuid().optional(),
  /** Board order within its column; sent by a drag. */
  position: z.number().finite().optional(),
  /** Order within its planned day, for Today; sent by a drag there. */
  dayPosition: z.number().finite().optional(),
  /** Moving lists gives the task the new list's next number. */
  listId: z.string().uuid().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

const columnName = z.string().trim().min(1).max(30);

export const createColumnSchema = z.object({
  name: columnName,
  /** The status its tasks have: what "done" means for it. */
  status,
});
export type CreateColumnInput = z.infer<typeof createColumnSchema>;

/** `name: null` goes back to the status's own name. */
export const updateColumnSchema = z.object({
  name: columnName.nullable().optional(),
  status: status.optional(),
  position: z.number().finite().optional(),
});
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;

/** `DELETE /todo-columns/:id?moveTo=<column id>`: where its tasks go; needed when it has any. */
export const deleteColumnQuerySchema = z.object({ moveTo: z.string().uuid().optional() });

export const todayQuerySchema = z.object({ today: day });
export const listTasksQuerySchema = z.object({
  /** Done tasks shown on a board: the most recently completed ones. */
  doneLimit: z.coerce.number().int().min(0).max(200).default(50),
});

/** `GET /tasks/search?q=paint&limit=10&exclude=<task id>` */
export const searchTasksQuerySchema = z.object({
  q: z.string().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(25).default(10),
  exclude: z.string().uuid().optional(),
});
export type SearchTasksQuery = z.infer<typeof searchTasksQuerySchema>;

/** Body of `POST /tasks/:id/dependencies`: the task it should wait for. */
export const addDependencySchema = z.object({ dependsOnId: z.string().uuid() });
export type AddDependencyInput = z.infer<typeof addDependencySchema>;
