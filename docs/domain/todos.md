# To-do Lists

One-off tasks next to habits: a plan for today in your own order, lists
with their own key prefix (`GRO-12`), a kanban board per list with its own
columns, due dates, and dependencies between tasks in any lists. Code: `apps/api/src/todos/`, `apps/bff/src/graphql/todos/`,
`apps/web/src/components/todos/`, pages under `/tasks`.

## Data model (`apps/api/prisma/schema.prisma`)

| Model | Fields | Notes |
| ----- | ------ | ----- |
| `TodoList` | `name`, `prefix` (unique), `nextNumber`, `isInbox`, `position` | The migration seeds an **Inbox** (prefix `TASK`) that catches tasks added without a list and can't be deleted |
| `TodoColumn` | `listId`, `name` (null = the status's own name), `status`, `position` | A list's board columns; see [Columns](#columns) |
| `Task` | `listId`, `number`, `title`, `notes`, `status` (TODO / IN_PROGRESS / DONE), `columnId`, `position`, `plannedFor` (date), `dayPosition`, `dueOn` (date), `completedAt` | `@@unique([listId, number])`; `status` is always its column's |
| `TaskDependency` | `taskId` waits for `dependsOnId` | Composite key; both sides cascade on delete |

## Keys and prefixes

- A task's key is `<list prefix>-<number>`, built **when read**, never
  stored. Renaming a prefix (`GRO` → `FOOD`) is one update, and every task in
  the list is re-keyed with its number unchanged.
- A prefix is 2–6 characters, a letter first, then letters or digits,
  uppercase. It's unique across lists. DailyPacer has no user accounts, so "your
  lists" is all lists; with accounts this would become `@@unique([userId, prefix])`.
- A new list's prefix is suggested from its name: the first three letters,
  accents folded (`Đi chợ` → `DIC`), then `DIC2`, `DIC3`… if taken
  (`suggestPrefix` in `todo.util.ts`).
- `nextNumber` only goes up, inside the same transaction that creates or
  moves the task, so a number is never handed out twice or reused, even
  after a delete.
- **Moving a task to another list gives it that list's next number**
  (`GRO-4` → `TASK-3`). The task dialog shows the new key before you save.

## Today, and earlier days

- `plannedFor` is the day a task is planned for, from **any** list.
- **Today is in your order**: drag a task's handle, or focus it and use
  Space and the arrow keys. A drop saves only that task's `dayPosition`
  (halfway between its neighbours, like the board). Planning a task for a
  day puts it last that day. Done tasks sit below the open ones.
- `/tasks` shows today's tasks from every list, then **Earlier, not done**:
  tasks planned before today that are still open, with "planned N days
  ago". Nothing moves on its own; each has Move to today / Unplan, and
  there's Move all to today.
- Then **Due soon**: open tasks due within 3 days (`DUE_SOON_DAYS`) or
  overdue that aren't planned for today or earlier, each with "Plan for
  today".
- `today` is always sent by the browser (local day), as elsewhere in the app.

## Due dates

- `dueOn` is the deadline; `plannedFor` is when you'll do it. Either can
  be set without the other, from the task dialog.
- A badge shows on every open task with one: "Overdue by 2 days" (red),
  "Due today" (amber), "Due 9 Oct" (`dueState` in `lib/todos.ts`). The
  flag and the words carry it, not colour alone.
- Reminders are in-app only (the badges and Due soon). Email or push
  would come with [email-and-notifications.md](../backend/email-and-notifications.md).

## Columns

- Every list has its own columns (`TodoColumn`), left to right. New lists
  start with To do, In progress and Done, unnamed so they show in the UI
  language; the migration gave every existing list the same three.
- **Each column counts as a status.** A task's status is always its
  column's, so Done, Today's tick box, "blocked" and the open/done counts
  work whatever the columns are called. Ticking a task off in Today moves
  it to its list's first Done column; un-ticking, to the first To do.
- **Edit columns** on the board: add (10 at most), rename (clear the name
  to go back to the status's own), move ← / →, change what it counts as
  (every task in it changes status at once), delete. Changes apply at once.
- Every list keeps at least one column per status, so new tasks and ticking
  off always have somewhere to go: the last one of a status can't be
  deleted or re-typed. Deleting a column with tasks asks which column they
  go to; they keep their order, after that column's own.
- Moving a task to another list puts it in that list's first column with
  the same status; the task dialog offers that list's columns.
- `Task.columnId` uses `onDelete: NoAction` (checked at the end of the
  statement), so deleting a list can cascade to both its columns and tasks.

## Board

- `/tasks/lists/$listId`: the list's columns, built with dnd-kit, side by
  side and scrolling sideways when there are many. Drag with the mouse, by touch, or focus a card and use Space and
  the arrow keys. A short drag threshold keeps a click opening the card.
- A drop saves only the moved task: its column (and so status) and a
  `position` halfway between its new neighbours (`positionBetween`), so
  nothing else is rewritten. Done columns are ordered by `completedAt`, so a
  drop there only sets the column. Moving between two Done columns keeps
  `completedAt`.
- Done columns show the 50 most recently completed tasks plus the total
  (`doneLimit`), so an old list doesn't load its whole history.

## Dependencies

- A task can **wait for** up to 20 others, in the same list or any other.
  The other direction ("blocks") is shown read-only.
- A task is **blocked** while anything it waits for isn't done. Blocked tasks
  show a lock badge ("Blocked by HOME-1 +1") on the board, in Today and in
  lists; the lock and the words carry it, not colour alone.
- Refused, with the reason: a task waiting for itself, and any link that
  would close a loop at any depth (`wouldCreateCycle`).
- Completing a blocked task is **allowed**, with a warning in the dialog, as
  in Jira or Linear.
- Deleting either task removes the link.
- **Picking a dependency** is an autocomplete (`TaskPicker`) over every
  list: by title, full key (`HOME-2`) or number (`2`), open tasks first.
  It never offers an invalid choice: the task itself, what it already waits
  for, and anything that waits for it (which would close a loop) are left
  out by the server (`searchTasks` with `exclude`). It follows the ARIA
  combobox pattern: ↑/↓, Enter to pick, Escape closes the results before
  the dialog.

## Forms and deleting

- **New list** is a modal. The name and prefix are validated with a zod
  schema (`todoListSchema` in `apps/web/src/lib/todos.ts`, shared with the
  edit form): required name up to 60 characters, the prefix format, and that
  no other list uses the prefix, naming that list ("TASK is already used by
  Inbox"). The API enforces the same rules and answers a taken prefix with
  409, which the BFF passes through as a `CONFLICT` error with its message.
- Deleting a task or a list asks first, **inline** in the dialog
  (`ConfirmPrompt`): what will be deleted, what else it affects ("HOME-2
  waits for it and will no longer be blocked by it", "and its 4 tasks"), and
  that it can't be undone. Focus starts on Cancel.

## API and GraphQL

REST endpoints are listed in [nestjs-structure.md](../backend/nestjs-structure.md).
GraphQL (`apps/bff/src/graphql/todos/`): `todoLists` (each with its
`columns`), `suggestListPrefix`, `listBoard`, `todayTasks` (`today`,
`earlier`, `dueSoon`), `taskByKey`, `searchTasks`; mutations
`createTodoList`, `updateTodoList`, `deleteTodoList`, `createTodoColumn`,
`updateTodoColumn`, `deleteTodoColumn(id, moveTo)`, `createTask`,
`updateTask` (`columnId`, `dayPosition`, `dueOn` among its fields),
`deleteTask`, `addTaskDependency` (by id or key) and
`removeTaskDependency`.
