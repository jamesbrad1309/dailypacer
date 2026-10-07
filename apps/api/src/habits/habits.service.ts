import { Injectable, NotFoundException } from "@nestjs/common";
import type { Habit, Prisma } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { type Day, addDays, toDay } from "#habits/day.util";
import type { CreateHabitInput } from "#habits/dto/create-habit.dto";
import type { UpdateHabitInput } from "#habits/dto/update-habit.dto";
import type { PauseRange } from "#habits/pause.util";
import { type HabitSchedule, isDueOn } from "#habits/schedule.util";

const log = scopedLogger("HabitsService");

@Injectable()
export class HabitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Habit[]> {
    await this.archiveEnded();
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
    await this.archiveEnded();
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
    const { customFields, endDate, ...rest } = input;
    const metadata = {
      ...input.metadata,
      ...(customFields ? { fields: customFields } : {}),
    };
    const habit = await this.prisma.habit.create({
      data: {
        ...rest,
        endDate: endDate ? new Date(endDate) : null,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
    // `name` is a reserved pino field (it renames the logger itself in
    // output), so the habit's name is logged as `habitName` instead.
    log.info({ habitId: habit.id, habitName: habit.name }, "habit created");
    return habit;
  }

  async update(id: string, input: UpdateHabitInput): Promise<Habit> {
    const { customFields, financeCategoryIds, endDate, ...rest } = input;
    let metadata: Prisma.InputJsonValue | undefined;
    if (customFields || financeCategoryIds) {
      const current = await this.findOneOrFail(id);
      metadata = {
        ...(current.metadata as object),
        ...(customFields && { fields: customFields }),
        ...(financeCategoryIds && { categoryIds: financeCategoryIds }),
      } as Prisma.InputJsonValue;
    }
    const habit = await this.prisma.habit.update({
      where: { id },
      data: {
        ...rest,
        schedule: input.schedule as Prisma.InputJsonValue | undefined,
        endDate: endDate === undefined ? undefined : endDate ? new Date(endDate) : null,
        metadata,
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

  /**
   * Each habit's days that aren't due, as ranges, for streaks, misses and
   * insights: its pause stretches, each frozen day (bought back with
   * points), and everything after a time-boxed habit's last day.
   */
  async pausesFor(habitIds: readonly string[]): Promise<Map<string, PauseRange[]>> {
    const [pauses, freezes, ended] = await Promise.all([
      this.realPausesFor(habitIds),
      this.freezesFor(habitIds),
      habitIds.length
        ? this.prisma.habit.findMany({
            where: { id: { in: [...habitIds] }, endDate: { not: null } },
            select: { id: true, endDate: true },
          })
        : [],
    ]);
    const byHabit = new Map<string, PauseRange[]>();
    const add = (habitId: string, range: PauseRange) =>
      byHabit.set(habitId, [...(byHabit.get(habitId) ?? []), range]);
    for (const [habitId, ranges] of pauses) for (const range of ranges) add(habitId, range);
    for (const [habitId, days] of freezes) {
      for (const day of days) add(habitId, { start: day, end: addDays(day, 1) });
    }
    for (const habit of ended) {
      if (habit.endDate) add(habit.id, { start: addDays(toDay(habit.endDate), 1), end: null });
    }
    return byHabit;
  }

  /** Each habit's real pause stretches (not freezes), as days. */
  async realPausesFor(habitIds: readonly string[]): Promise<Map<string, PauseRange[]>> {
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

  /** Each habit's frozen days. */
  async freezesFor(habitIds: readonly string[]): Promise<Map<string, Set<Day>>> {
    const rows = habitIds.length
      ? await this.prisma.streakFreeze.findMany({ where: { habitId: { in: [...habitIds] } } })
      : [];
    const byHabit = new Map<string, Set<Day>>();
    for (const row of rows) {
      const days = byHabit.get(row.habitId) ?? new Set<Day>();
      days.add(toDay(row.date));
      byHabit.set(row.habitId, days);
    }
    return byHabit;
  }

  /**
   * Time-boxed habits archive themselves once their last day has passed
   * (on the server's day; a day late at worst). Their history stays.
   */
  async archiveEnded(today: Day = toDay(new Date())): Promise<void> {
    const { count } = await this.prisma.habit.updateMany({
      where: { archivedAt: null, endDate: { lt: new Date(today) } },
      data: { archivedAt: new Date() },
    });
    if (count > 0) log.info({ count }, "time-boxed habits archived");
  }
}
