import { Injectable, NotFoundException } from "@nestjs/common";
import type { Habit, Prisma } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { type Day, toDay } from "#habits/day.util";
import type { CreateHabitInput } from "#habits/dto/create-habit.dto";
import type { UpdateHabitInput } from "#habits/dto/update-habit.dto";
import type { PauseRange } from "#habits/pause.util";
import { type HabitSchedule, isDueOn } from "#habits/schedule.util";

const log = scopedLogger("HabitsService");

@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Habit[]> {
    return this.prisma.habit.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  findArchived(): Promise<Habit[]> {
    return this.prisma.habit.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
    });
  }

  async findDueToday(): Promise<Habit[]> {
    const all = await this.prisma.habit.findMany({
      where: { archivedAt: null, pausedAt: null },
      orderBy: { createdAt: "asc" },
    });
    const today = new Date();
    return all.filter((habit) => isDueOn(habit.schedule as HabitSchedule, today));
  }

  findManyByIds(ids: readonly string[]): Promise<Habit[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.habit.findMany({ where: { id: { in: [...ids] } } });
  }

  async findOneOrFail(id: string): Promise<Habit> {
    const habit = await this.prisma.habit.findUnique({ where: { id } });
    if (!habit) {
      throw new NotFoundException(`Habit ${id} not found`);
    }
    return habit;
  }

  async create(input: CreateHabitInput): Promise<Habit> {
    const habit = await this.prisma.habit.create({
      data: {
        ...input,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    // `name` is a reserved pino field (it renames the logger itself in
    // output), so the habit's name is logged as `habitName` instead.
    log.info({ habitId: habit.id, habitName: habit.name }, "habit created");
    return habit;
  }

  async update(id: string, input: UpdateHabitInput): Promise<Habit> {
    const habit = await this.prisma.habit.update({
      where: { id },
      data: {
        ...input,
        schedule: input.schedule as Prisma.InputJsonValue | undefined,
      },
    });
    log.info({ habitId: habit.id }, "habit updated");
    return habit;
  }

  async archive(id: string): Promise<Habit> {
    const habit = await this.prisma.habit.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    log.info({ habitId: habit.id }, "habit archived");
    return habit;
  }

  async unarchive(id: string): Promise<Habit> {
    const habit = await this.prisma.habit.update({
      where: { id },
      data: { archivedAt: null },
    });
    log.info({ habitId: habit.id }, "habit unarchived");
    return habit;
  }

  /**
   * Pauses from `day` (the user's local today; the server's UTC day if not
   * sent) and records it in habit_pauses, so the stretch is skipped by
   * streaks and misses later. Pausing a paused habit changes nothing.
   */
  async pause(id: string, day: Day = toDay(new Date())): Promise<Habit> {
    const current = await this.findOneOrFail(id);
    if (current.pausedAt) return current;
    const habit = await this.prisma.$transaction(async (tx) => {
      await tx.habitPause.create({ data: { habitId: id, startDate: new Date(day) } });
      return tx.habit.update({ where: { id }, data: { pausedAt: new Date() } });
    });
    log.info({ habitId: habit.id, day }, "habit paused");
    return habit;
  }

  /** Resumes from `day`: closes the open pause, so the habit is due again from that day. */
  async resume(id: string, day: Day = toDay(new Date())): Promise<Habit> {
    const current = await this.findOneOrFail(id);
    if (!current.pausedAt) return current;
    const habit = await this.prisma.$transaction(async (tx) => {
      await tx.habitPause.updateMany({
        where: { habitId: id, endDate: null },
        data: { endDate: new Date(day) },
      });
      return tx.habit.update({ where: { id }, data: { pausedAt: null } });
    });
    log.info({ habitId: habit.id, day }, "habit resumed");
    return habit;
  }

  /** Each habit's pause stretches, as days, for streaks and misses. */
  async pausesFor(habitIds: readonly string[]): Promise<Map<string, PauseRange[]>> {
    const rows = habitIds.length
      ? await this.prisma.habitPause.findMany({ where: { habitId: { in: [...habitIds] } } })
      : [];
    const byHabit = new Map<string, PauseRange[]>();
    for (const row of rows) {
      const range = { start: toDay(row.startDate), end: row.endDate ? toDay(row.endDate) : null };
      byHabit.set(row.habitId, [...(byHabit.get(row.habitId) ?? []), range]);
    }
    return byHabit;
  }
}
