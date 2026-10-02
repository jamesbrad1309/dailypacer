import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, Task, TaskStatus, TodoList } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import type {
  CreateListInput,
  CreateTaskInput,
  UpdateListInput,
  UpdateTaskInput,
} from "#todos/dto/todo.dto";
import { formatKey, parseKey, suggestPrefix } from "#todos/todo.util";

const log = scopedLogger("TodosService");

type ListRef = Pick<TodoList, "id" | "name" | "prefix" | "isInbox">;
const LIST_REF = { select: { id: true, name: true, prefix: true, isInbox: true } } as const;

/** A task as sent out: its key from the list's current prefix, dates as days. */
export function toTaskDto(task: Task & { list: ListRef }) {
  return {
    ...task,
    key: formatKey(task.list.prefix, task.number),
    plannedFor: task.plannedFor ? task.plannedFor.toISOString().slice(0, 10) : null,
  };
}
export type TaskDto = ReturnType<typeof toTaskDto>;

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Lists ──────────────────────────────────────────────────────────────

  /** All lists, Inbox first, with open / done counts. */
  async lists() {
    const [lists, counts] = await Promise.all([
      this.prisma.todoList.findMany({
        orderBy: [{ isInbox: "desc" }, { position: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.task.groupBy({ by: ["listId", "status"], _count: { _all: true } }),
    ]);
    return lists.map((list) => {
      const of = (status: TaskStatus) =>
        counts.find((c) => c.listId === list.id && c.status === status)?._count._all ?? 0;
      return { ...list, openCount: of("TODO") + of("IN_PROGRESS"), doneCount: of("DONE") };
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
      data: { name, prefix: chosen, position: (last._max.position ?? 0) + 1 },
    });
    log.info({ listId: list.id, prefix: list.prefix }, "todo list created");
    return list;
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
    return this.prisma.todoList.update({ where: { id }, data: input });
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
    const [open, done, doneTotal] = await Promise.all([
      this.prisma.task.findMany({
        where: { listId, status: { not: "DONE" } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: { list: LIST_REF },
      }),
      this.prisma.task.findMany({
        where: { listId, status: "DONE" },
        orderBy: { completedAt: "desc" },
        take: doneLimit,
        include: { list: LIST_REF },
      }),
      this.prisma.task.count({ where: { listId, status: "DONE" } }),
    ]);
    return {
      list: { ...list, openCount: open.length, doneCount: doneTotal },
      tasks: [...open, ...done].map(toTaskDto),
      doneTotal,
    };
  }

  /**
   * Today's plan from every list, plus anything planned for an earlier day
   * and still not done ("Earlier, not done"): nothing moves on its own.
   */
  async today(today: string) {
    const day = new Date(today);
    const [planned, earlier] = await Promise.all([
      this.prisma.task.findMany({
        where: { plannedFor: day },
        orderBy: [{ completedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
        include: { list: LIST_REF },
      }),
      this.prisma.task.findMany({
        where: { plannedFor: { lt: day }, status: { not: "DONE" } },
        orderBy: [{ plannedFor: "asc" }, { createdAt: "asc" }],
        include: { list: LIST_REF },
      }),
    ]);
    return { today: planned.map(toTaskDto), earlier: earlier.map(toTaskDto) };
  }

  async taskByKey(key: string) {
    const parsed = parseKey(key);
    if (!parsed) throw new BadRequestException(`${key} isn't a task key (like GRO-12)`);
    const task = await this.prisma.task.findFirst({
      where: { number: parsed.number, list: { prefix: parsed.prefix } },
      include: { list: LIST_REF },
    });
    if (!task) throw new NotFoundException(`No task ${parsed.prefix}-${parsed.number}`);
    return toTaskDto(task);
  }

  async createTask(input: CreateTaskInput) {
    const listId = input.listId ? (await this.list(input.listId)).id : (await this.inbox()).id;
    const status = input.status ?? "TODO";
    const task = await this.prisma.$transaction(async (tx) => {
      const number = await this.takeNumber(tx, listId);
      return tx.task.create({
        data: {
          listId,
          number,
          title: input.title,
          notes: input.notes ?? null,
          status,
          position: await this.endOfColumn(tx, listId, status),
          plannedFor: input.plannedFor ? new Date(input.plannedFor) : null,
          completedAt: status === "DONE" ? new Date() : null,
        },
        include: { list: LIST_REF },
      });
    });
    log.info({ taskId: task.id, key: formatKey(task.list.prefix, task.number) }, "task created");
    return toTaskDto(task);
  }

  /**
   * Partial update. Moving to another list takes that list's next number
   * (the old number isn't carried over or reused). A status change without
   * a position puts the task at the end of its new column.
   */
  async updateTask(id: string, input: UpdateTaskInput) {
    const current = await this.prisma.task.findUnique({ where: { id } });
    if (!current) throw new NotFoundException(`Task ${id} not found`);

    const task = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.TaskUncheckedUpdateInput = {
        title: input.title,
        notes: input.notes,
        position: input.position,
      };
      if (input.plannedFor !== undefined) {
        data.plannedFor = input.plannedFor ? new Date(input.plannedFor) : null;
      }
      const listId = input.listId ?? current.listId;
      if (input.listId && input.listId !== current.listId) {
        await this.list(input.listId);
        data.listId = input.listId;
        data.number = await this.takeNumber(tx, input.listId);
      }
      const status = input.status ?? current.status;
      if (input.status && input.status !== current.status) {
        data.status = input.status;
        data.completedAt = input.status === "DONE" ? new Date() : null;
      }
      if (input.position === undefined && (data.status || data.listId)) {
        data.position = await this.endOfColumn(tx, listId, status);
      }
      return tx.task.update({ where: { id }, data, include: { list: LIST_REF } });
    });
    return toTaskDto(task);
  }

  async deleteTask(id: string) {
    const task = await this.prisma.task.delete({ where: { id }, include: { list: LIST_REF } });
    log.info({ taskId: id }, "task deleted");
    return toTaskDto(task);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

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

  private async endOfColumn(tx: Prisma.TransactionClient, listId: string, status: TaskStatus) {
    const last = await tx.task.aggregate({ where: { listId, status }, _max: { position: true } });
    return (last._max.position ?? 0) + 1;
  }
}
