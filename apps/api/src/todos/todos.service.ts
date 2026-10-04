import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, Task, TaskStatus, TodoColumn, TodoList } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import type {
  CreateColumnInput,
  CreateListInput,
  CreateTaskInput,
  UpdateColumnInput,
  UpdateListInput,
  UpdateTaskInput,
} from "#todos/dto/todo.dto";
import {
  DEFAULT_COLUMNS,
  DUE_SOON_DAYS,
  MAX_COLUMNS,
  MAX_DEPENDENCIES,
  addDays,
  completedAtFor,
  formatKey,
  parseKey,
  suggestPrefix,
  wouldCreateCycle,
} from "#todos/todo.util";

const log = scopedLogger("TodosService");

type ListRef = Pick<TodoList, "id" | "name" | "prefix" | "isInbox">;
const LIST_REF = { select: { id: true, name: true, prefix: true, isInbox: true } } as const;

/** Just enough of a linked task to show it: key, title, status. */
const TASK_REF = {
  select: { id: true, number: true, title: true, status: true, list: { select: { prefix: true } } },
} as const;
type TaskRefRow = Pick<Task, "id" | "number" | "title" | "status"> & { list: { prefix: string } };

/** What every task query loads: its list and both directions of its dependencies. */
const TASK_INCLUDE = {
  list: LIST_REF,
  blockedBy: { select: { dependsOn: TASK_REF } },
  blocks: { select: { task: TASK_REF } },
} as const;
type TaskRow = Task & {
  list: ListRef;
  blockedBy: { dependsOn: TaskRefRow }[];
  blocks: { task: TaskRefRow }[];
};

const toRef = (task: TaskRefRow) => ({
  id: task.id,
  key: formatKey(task.list.prefix, task.number),
  title: task.title,
  status: task.status,
});

/**
 * A task as sent out: its key from the list's current prefix, dates as days,
 * and its dependencies both ways. `blocked` while anything it waits for
 * isn't done.
 */
export function toTaskDto({ blockedBy, blocks, ...task }: TaskRow) {
  const waitingFor = blockedBy.map((link) => toRef(link.dependsOn));
  return {
    ...task,
    key: formatKey(task.list.prefix, task.number),
    plannedFor: task.plannedFor ? task.plannedFor.toISOString().slice(0, 10) : null,
    dueOn: task.dueOn ? task.dueOn.toISOString().slice(0, 10) : null,
    blockedBy: waitingFor,
    blocks: blocks.map((link) => toRef(link.task)),
    blocked: waitingFor.some((dep) => dep.status !== "DONE"),
  };
}
export type TaskDto = ReturnType<typeof toTaskDto>;

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Lists ──────────────────────────────────────────────────────────────

  /** All lists, Inbox first, with open / done counts and their columns (for the task dialog). */
  async lists() {
    const [lists, counts, columns, columnCounts] = await Promise.all([
      this.prisma.todoList.findMany({
        orderBy: [{ isInbox: "desc" }, { position: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.task.groupBy({ by: ["listId", "status"], _count: { _all: true } }),
      this.prisma.todoColumn.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
      this.prisma.task.groupBy({ by: ["columnId"], _count: { _all: true } }),
    ]);
    return lists.map((list) => {
      const of = (status: TaskStatus) =>
        counts.find((c) => c.listId === list.id && c.status === status)?._count._all ?? 0;
      return {
        ...list,
        openCount: of("TODO") + of("IN_PROGRESS"),
        doneCount: of("DONE"),
        columns: columns
          .filter((column) => column.listId === list.id)
          .map((column) => ({
            ...column,
            taskCount: columnCounts.find((c) => c.columnId === column.id)?._count._all ?? 0,
          })),
      };
    });
  }

  async list(id: string) {
    const list = await this.prisma.todoList.findUnique({ where: { id } });
    if (!list) throw new NotFoundException(`List ${id} not found`);
    return list;
  }

  async createList({ name, prefix }: CreateListInput) {
    const taken = await this.takenPrefixes();
    const chosen = prefix ?? suggestPrefix(name, taken);
    if (taken.has(chosen)) throw new ConflictException(`Prefix ${chosen} is already used`);
    const last = await this.prisma.todoList.aggregate({ _max: { position: true } });
    const list = await this.prisma.todoList.create({
      data: {
        name,
        prefix: chosen,
        position: (last._max.position ?? 0) + 1,
        columns: { create: [...DEFAULT_COLUMNS] },
      },
    });
    log.info({ listId: list.id, prefix: list.prefix }, "todo list created");
    return { ...list, openCount: 0, doneCount: 0, columns: await this.columnsOf(list.id) };
  }

  /** A prefix change re-keys every task in the list at once; their numbers stay. */
  async updateList(id: string, input: UpdateListInput) {
    const list = await this.list(id);
    if (input.prefix && input.prefix !== list.prefix) {
      const taken = await this.takenPrefixes();
      if (taken.has(input.prefix)) {
        throw new ConflictException(`Prefix ${input.prefix} is already used`);
      }
    }
    const updated = await this.prisma.todoList.update({ where: { id }, data: input });
    return { ...updated, ...(await this.countsFor(id)), columns: await this.columnsOf(id) };
  }

  /** Deletes a list and its tasks. The Inbox stays. */
  async deleteList(id: string) {
    const list = await this.list(id);
    if (list.isInbox) throw new BadRequestException("The Inbox can't be deleted");
    await this.prisma.todoList.delete({ where: { id } });
    log.info({ listId: id }, "todo list deleted");
    return list;
  }

  /** Suggests a free prefix for a list name (shown as the form's default). */
  async suggestPrefixFor(name: string) {
    return suggestPrefix(name, await this.takenPrefixes());
  }

  // ─── Tasks ──────────────────────────────────────────────────────────────

  /**
   * A list's board: every open task (To do, In progress) by position, and
   * only the most recently completed `doneLimit` Done ones, plus how many
   * Done there are in all, so a long-lived list doesn't load its history.
   */
  async listTasks(listId: string, doneLimit: number) {
    const list = await this.list(listId);
    const [columns, open, done, doneTotal] = await Promise.all([
      this.columnsOf(listId),
      this.prisma.task.findMany({
        where: { listId, status: { not: "DONE" } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: TASK_INCLUDE,
      }),
      this.prisma.task.findMany({
        where: { listId, status: "DONE" },
        orderBy: { completedAt: "desc" },
        take: doneLimit,
        include: TASK_INCLUDE,
      }),
      this.prisma.task.count({ where: { listId, status: "DONE" } }),
    ]);
    return {
      list: { ...list, openCount: open.length, doneCount: doneTotal, columns },
      tasks: [...open, ...done].map(toTaskDto),
      doneTotal,
    };
  }

  /**
   * Today's plan from every list in the user's order (open first, then
   * done), anything planned for an earlier day and still not done
   * ("Earlier, not done": nothing moves on its own), and open tasks due
   * within DUE_SOON_DAYS or overdue that aren't planned for today or
   * earlier, so a deadline isn't missed just because it wasn't planned.
   */
  async today(today: string) {
    const day = new Date(today);
    const [planned, earlier, dueSoon] = await Promise.all([
      this.prisma.task.findMany({
        where: { plannedFor: day },
        orderBy: [{ dayPosition: "asc" }, { createdAt: "asc" }],
        include: TASK_INCLUDE,
      }),
      this.prisma.task.findMany({
        where: { plannedFor: { lt: day }, status: { not: "DONE" } },
        orderBy: [{ plannedFor: "asc" }, { createdAt: "asc" }],
        include: TASK_INCLUDE,
      }),
      this.prisma.task.findMany({
        where: {
          status: { not: "DONE" },
          dueOn: { lte: addDays(today, DUE_SOON_DAYS) },
          OR: [{ plannedFor: null }, { plannedFor: { gt: day } }],
        },
        orderBy: [{ dueOn: "asc" }, { createdAt: "asc" }],
        include: TASK_INCLUDE,
      }),
    ]);
    const isDone = (task: Task) => task.status === "DONE";
    return {
      today: [...planned.filter((t) => !isDone(t)), ...planned.filter(isDone)].map(toTaskDto),
      earlier: earlier.map(toTaskDto),
      dueSoon: dueSoon.map(toTaskDto),
    };
  }

  /**
   * Tasks matching `q` across every list, for picking one (e.g. a
   * dependency): by title (case-insensitive, anywhere in it), by full key
   * ("HOME-2", using current prefixes) or by number ("2"). Open tasks first,
   * then most recently updated. With `exclude` it offers only valid
   * dependencies for that task: not itself, not what it already waits for,
   * and not anything that waits for it (directly or through others), which
   * would close a loop.
   */
  async searchTasks(q: string, limit: number, exclude?: string) {
    const text = q.trim();
    if (!text) return [];
    const key = parseKey(text);
    const number = /^\d{1,9}$/.test(text) ? Number(text) : null;
    const excluded = exclude ? await this.notPickableFor(exclude) : [];
    const tasks = await this.prisma.task.findMany({
      where: {
        id: { notIn: excluded },
        OR: [
          { title: { contains: text, mode: "insensitive" } },
          ...(key ? [{ number: key.number, list: { prefix: key.prefix } }] : []),
          ...(number !== null ? [{ number }] : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: limit * 3,
      include: TASK_INCLUDE,
    });
    // Open before done; within each, the database's most-recent-first order.
    return [...tasks]
      .sort((a, b) => Number(a.status === "DONE") - Number(b.status === "DONE"))
      .slice(0, limit)
      .map(toTaskDto);
  }

  async taskByKey(key: string) {
    const parsed = parseKey(key);
    if (!parsed) throw new BadRequestException(`${key} isn't a task key (like GRO-12)`);
    const task = await this.prisma.task.findFirst({
      where: { number: parsed.number, list: { prefix: parsed.prefix } },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException(`No task ${parsed.prefix}-${parsed.number}`);
    return toTaskDto(task);
  }

  /** In `columnId` when given (its list), else the first column of `status` (To do) in the list (Inbox). */
  async createTask(input: CreateTaskInput) {
    const column = input.columnId
      ? await this.column(input.columnId)
      : await this.firstColumn(
          input.listId ? (await this.list(input.listId)).id : (await this.inbox()).id,
          input.status ?? "TODO",
        );
    if (input.listId && column.listId !== input.listId) {
      throw new BadRequestException("That column belongs to another list");
    }
    const plannedFor = input.plannedFor ? new Date(input.plannedFor) : null;
    const task = await this.prisma.$transaction(async (tx) => {
      const number = await this.takeNumber(tx, column.listId);
      return tx.task.create({
        data: {
          listId: column.listId,
          number,
          title: input.title,
          notes: input.notes ?? null,
          status: column.status,
          columnId: column.id,
          position: await this.endOfColumn(tx, column.id),
          plannedFor,
          dayPosition: plannedFor ? await this.endOfDay(tx, plannedFor) : 0,
          dueOn: input.dueOn ? new Date(input.dueOn) : null,
          completedAt: column.status === "DONE" ? new Date() : null,
        },
        include: TASK_INCLUDE,
      });
    });
    log.info({ taskId: task.id, key: formatKey(task.list.prefix, task.number) }, "task created");
    return toTaskDto(task);
  }

  /**
   * Partial update. Moving to another list takes that list's next number
   * (the old number isn't carried over or reused) and the first column there
   * with the same status. A column sets the status; a status alone picks
   * that status's first column. Changing column without a position puts the
   * task at its end; planning it for another day without a `dayPosition`
   * puts it last that day.
   */
  async updateTask(id: string, input: UpdateTaskInput) {
    const current = await this.prisma.task.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Task ${id} not found`);
    const listId = input.listId ?? current.listId;
    const movingList = listId !== current.listId;
    if (movingList) await this.list(listId);

    let column: Pick<TodoColumn, "id" | "listId" | "status"> | null = null;
    if (input.columnId) {
      column = await this.column(input.columnId);
      if (column.listId !== listId) {
        throw new BadRequestException("That column belongs to another list");
      }
    } else if (movingList || (input.status && input.status !== current.status)) {
      column = await this.firstColumn(listId, input.status ?? current.status);
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.TaskUncheckedUpdateInput = {
        title: input.title,
        notes: input.notes,
        position: input.position,
        dayPosition: input.dayPosition,
      };
      if (input.plannedFor !== undefined) {
        const plannedFor = input.plannedFor ? new Date(input.plannedFor) : null;
        data.plannedFor = plannedFor;
        const sameDay = plannedFor?.getTime() === current.plannedFor?.getTime();
        if (plannedFor && !sameDay && input.dayPosition === undefined) {
          data.dayPosition = await this.endOfDay(tx, plannedFor);
        }
      }
      if (input.dueOn !== undefined) data.dueOn = input.dueOn ? new Date(input.dueOn) : null;
      if (movingList) {
        data.listId = listId;
        data.number = await this.takeNumber(tx, listId);
      }
      if (column && column.id !== current.columnId) {
        data.columnId = column.id;
        data.status = column.status;
        data.completedAt = completedAtFor(current.status, column.status, current.completedAt);
        if (input.position === undefined) data.position = await this.endOfColumn(tx, column.id);
      }
      return tx.task.update({ where: { id }, data, include: TASK_INCLUDE });
    });
    return toTaskDto(task);
  }

  async deleteTask(id: string) {
    const task = await this.prisma.task.delete({ where: { id }, include: TASK_INCLUDE });
    log.info({ taskId: id }, "task deleted");
    return toTaskDto(task);
  }

  // ─── Columns ────────────────────────────────────────────────────────────

  /** Adds a column at the right end of the board. At most MAX_COLUMNS per list. */
  async createColumn(listId: string, input: CreateColumnInput) {
    await this.list(listId);
    const columns = await this.columnsOf(listId);
    if (columns.length >= MAX_COLUMNS) {
      throw new BadRequestException(`A list can have at most ${MAX_COLUMNS} columns`);
    }
    const column = await this.prisma.todoColumn.create({
      data: {
        listId,
        name: input.name,
        status: input.status,
        position: (columns.at(-1)?.position ?? 0) + 1,
      },
    });
    log.info({ listId, columnId: column.id }, "todo column created");
    return { ...column, taskCount: 0 };
  }

  /**
   * Rename (null = the status's own name), move (`position`) or change what
   * a column means. A new status applies to every task in it at once; it's
   * refused if it would leave the list without a column for the old status.
   */
  async updateColumn(id: string, input: UpdateColumnInput) {
    const column = await this.column(id);
    const statusChange = input.status && input.status !== column.status ? input.status : null;
    if (statusChange) await this.assertNotLastOfStatus(column);
    await this.prisma.$transaction(async (tx) => {
      if (statusChange) {
        await this.retagTasks(tx, column.id, column.status, statusChange);
      }
      await tx.todoColumn.update({
        where: { id },
        data: { name: input.name, status: input.status, position: input.position },
      });
    });
    return (await this.columnsOf(column.listId)).find((c) => c.id === id);
  }

  /**
   * Deletes a column. Its tasks go to the end of `moveTo` (another column
   * of the same list, taking its status), which is required if there are
   * any. The last column of a status can't go: new tasks start in To do,
   * and ticking a task off needs a Done.
   */
  async deleteColumn(id: string, moveTo?: string) {
    const column = await this.column(id);
    await this.assertNotLastOfStatus(column);
    const taskCount = await this.prisma.task.count({ where: { columnId: id } });
    let target: TodoColumn | null = null;
    if (taskCount > 0) {
      if (!moveTo) {
        throw new BadRequestException("Choose a column to move this column's tasks to");
      }
      target = await this.column(moveTo);
      if (target.listId !== column.listId || target.id === column.id) {
        throw new BadRequestException("Move the tasks to another column of the same list");
      }
    }
    await this.prisma.$transaction(async (tx) => {
      if (target) {
        if (target.status !== column.status) {
          await this.retagTasks(tx, column.id, column.status, target.status);
        }
        // Keep their order, after the target's own tasks: one shift for all.
        const [first, last] = await Promise.all([
          tx.task.aggregate({ where: { columnId: id }, _min: { position: true } }),
          tx.task.aggregate({ where: { columnId: target.id }, _max: { position: true } }),
        ]);
        await tx.task.updateMany({
          where: { columnId: id },
          data: {
            columnId: target.id,
            position: {
              increment: (last._max.position ?? 0) + 1 - (first._min.position ?? 0),
            },
          },
        });
      }
      await tx.todoColumn.delete({ where: { id } });
    });
    log.info({ columnId: id, moveTo: target?.id, taskCount }, "todo column deleted");
    return column;
  }

  // ─── Dependencies ───────────────────────────────────────────────────────

  /**
   * Makes `taskId` wait for `dependsOnId` (any list). Refuses a task waiting
   * for itself, a loop (A waits for B waits for A, at any depth) and more
   * than MAX_DEPENDENCIES; adding one that exists already is a no-op.
   */
  async addDependency(taskId: string, dependsOnId: string) {
    const [task, dependsOn] = await Promise.all([
      this.prisma.task.findUnique({ where: { id: taskId }, include: { list: LIST_REF } }),
      this.prisma.task.findUnique({ where: { id: dependsOnId }, include: { list: LIST_REF } }),
    ]);
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    if (!dependsOn) throw new NotFoundException(`Task ${dependsOnId} not found`);
    const taskKey = formatKey(task.list.prefix, task.number);
    const otherKey = formatKey(dependsOn.list.prefix, dependsOn.number);
    if (taskId === dependsOnId) throw new BadRequestException("A task can't wait for itself");

    const links = await this.prisma.taskDependency.findMany({
      select: { taskId: true, dependsOnId: true },
    });
    if (links.some((l) => l.taskId === taskId && l.dependsOnId === dependsOnId)) {
      return this.task(taskId);
    }
    if (links.filter((l) => l.taskId === taskId).length >= MAX_DEPENDENCIES) {
      throw new BadRequestException(`A task can wait for at most ${MAX_DEPENDENCIES} others`);
    }
    const edges = new Map<string, string[]>();
    for (const link of links) {
      edges.set(link.taskId, [...(edges.get(link.taskId) ?? []), link.dependsOnId]);
    }
    if (wouldCreateCycle(taskId, dependsOnId, edges)) {
      throw new BadRequestException(
        `${otherKey} already waits for ${taskKey}, directly or through other tasks`,
      );
    }
    await this.prisma.taskDependency.create({ data: { taskId, dependsOnId } });
    log.info({ taskId, dependsOnId }, "task dependency added");
    return this.task(taskId);
  }

  async removeDependency(taskId: string, dependsOnId: string) {
    await this.prisma.taskDependency.deleteMany({ where: { taskId, dependsOnId } });
    return this.task(taskId);
  }

  async task(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return toTaskDto(task);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /** Tasks `taskId` can't be made to wait for: itself, its current dependencies, and its dependents at any depth. */
  private async notPickableFor(taskId: string): Promise<string[]> {
    const links = await this.prisma.taskDependency.findMany({
      select: { taskId: true, dependsOnId: true },
    });
    const waitingOn = new Map<string, string[]>();
    for (const link of links) {
      waitingOn.set(link.dependsOnId, [...(waitingOn.get(link.dependsOnId) ?? []), link.taskId]);
    }
    const dependents = new Set<string>();
    const queue = [taskId];
    while (queue.length > 0) {
      for (const next of waitingOn.get(queue.shift() as string) ?? []) {
        if (!dependents.has(next)) {
          dependents.add(next);
          queue.push(next);
        }
      }
    }
    const current = links.filter((l) => l.taskId === taskId).map((l) => l.dependsOnId);
    return [taskId, ...current, ...dependents];
  }

  /** Open (To do + In progress) and done task counts, as `lists()` returns them. */
  private async countsFor(listId: string) {
    const [openCount, doneCount] = await Promise.all([
      this.prisma.task.count({ where: { listId, status: { not: "DONE" } } }),
      this.prisma.task.count({ where: { listId, status: "DONE" } }),
    ]);
    return { openCount, doneCount };
  }

  private async inbox() {
    const inbox = await this.prisma.todoList.findFirst({ where: { isInbox: true } });
    if (!inbox) throw new NotFoundException("Inbox list missing: run the migrations");
    return inbox;
  }

  private async takenPrefixes(): Promise<Set<string>> {
    const lists = await this.prisma.todoList.findMany({ select: { prefix: true } });
    return new Set(lists.map((list) => list.prefix));
  }

  /** The list's next number, bumped in the same transaction (row lock): never handed out twice. */
  private async takeNumber(tx: Prisma.TransactionClient, listId: string): Promise<number> {
    const list = await tx.todoList.update({
      where: { id: listId },
      data: { nextNumber: { increment: 1 } },
      select: { nextNumber: true },
    });
    return list.nextNumber - 1;
  }

  private async endOfColumn(tx: Prisma.TransactionClient, columnId: string) {
    const last = await tx.task.aggregate({ where: { columnId }, _max: { position: true } });
    return (last._max.position ?? 0) + 1;
  }

  /** After the last task planned for that day, from any list. */
  private async endOfDay(tx: Prisma.TransactionClient, day: Date) {
    const last = await tx.task.aggregate({
      where: { plannedFor: day },
      _max: { dayPosition: true },
    });
    return (last._max.dayPosition ?? 0) + 1;
  }

  /** A list's columns, left to right, with how many tasks each holds. */
  private async columnsOf(listId: string) {
    const [columns, counts] = await Promise.all([
      this.prisma.todoColumn.findMany({
        where: { listId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.task.groupBy({ by: ["columnId"], where: { listId }, _count: { _all: true } }),
    ]);
    return columns.map((column) => ({
      ...column,
      taskCount: counts.find((c) => c.columnId === column.id)?._count._all ?? 0,
    }));
  }

  private async column(id: string) {
    const column = await this.prisma.todoColumn.findUnique({ where: { id } });
    if (!column) throw new NotFoundException(`Column ${id} not found`);
    return column;
  }

  /** The leftmost column of a status: where a task goes when only its status is known. */
  private async firstColumn(listId: string, status: TaskStatus) {
    const column = await this.prisma.todoColumn.findFirst({
      where: { listId, status },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    if (!column) throw new NotFoundException(`List ${listId} has no ${status} column`);
    return column;
  }

  private async assertNotLastOfStatus(column: TodoColumn) {
    const same = await this.prisma.todoColumn.count({
      where: { listId: column.listId, status: column.status },
    });
    if (same <= 1) {
      throw new BadRequestException(
        `This is the list's only ${column.status} column; every list keeps one per status`,
      );
    }
  }

  /** Every task in a column takes a new status, with completedAt set or cleared to match. */
  private async retagTasks(
    tx: Prisma.TransactionClient,
    columnId: string,
    from: TaskStatus,
    to: TaskStatus,
  ) {
    if (from === to) return;
    await tx.task.updateMany({
      where: { columnId },
      data: { status: to, completedAt: to === "DONE" ? new Date() : null },
    });
  }
}
