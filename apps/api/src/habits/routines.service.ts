import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import type { RoutineInput, UpdateRoutineInput } from "#habits/dto/motivation.dto";

const log = scopedLogger("RoutinesService");

const WITH_HABITS = {
  habits: { orderBy: { position: "asc" }, select: { habitId: true } },
} as const;

type RoutineRow = Prisma.RoutineGetPayload<{ include: typeof WITH_HABITS }>;

/** A routine with its habits' ids in order. */
function toDto({ habits, ...routine }: RoutineRow) {
  return { ...routine, habitIds: habits.map((h) => h.habitId) };
}

/**
 * Routines: habits checked off together, in order ("Morning routine"). A
 * habit is in at most one routine; putting it in another moves it.
 */
@Injectable()
export class RoutinesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const routines = await this.prisma.routine.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: WITH_HABITS,
    });
    return routines.map(toDto);
  }

  async create(input: RoutineInput) {
    await this.assertHabits(input.habitIds);
    const last = await this.prisma.routine.aggregate({ _max: { position: true } });
    const routine = await this.prisma.$transaction(async (tx) => {
      const created = await tx.routine.create({
        data: {
          name: input.name,
          icon: input.icon ?? null,
          startTime: input.startTime ?? null,
          position: (last._max.position ?? 0) + 1,
        },
      });
      await this.setHabits(tx, created.id, input.habitIds);
      return tx.routine.findUniqueOrThrow({ where: { id: created.id }, include: WITH_HABITS });
    });
    log.info({ routineId: routine.id, habits: input.habitIds.length }, "routine created");
    return toDto(routine);
  }

  async update(id: string, input: UpdateRoutineInput) {
    await this.routine(id);
    if (input.habitIds) await this.assertHabits(input.habitIds);
    const routine = await this.prisma.$transaction(async (tx) => {
      await tx.routine.update({
        where: { id },
        data: {
          name: input.name,
          icon: input.icon,
          startTime: input.startTime,
          position: input.position,
        },
      });
      if (input.habitIds) await this.setHabits(tx, id, input.habitIds);
      return tx.routine.findUniqueOrThrow({ where: { id }, include: WITH_HABITS });
    });
    return toDto(routine);
  }

  /** Deletes the routine; its habits stay, outside any routine. */
  async remove(id: string) {
    await this.routine(id);
    await this.prisma.routine.delete({ where: { id } });
    log.info({ routineId: id }, "routine deleted");
    return { id };
  }

  private async setHabits(tx: Prisma.TransactionClient, routineId: string, habitIds: string[]) {
    await tx.routineHabit.deleteMany({
      where: { OR: [{ routineId }, { habitId: { in: habitIds } }] },
    });
    await tx.routineHabit.createMany({
      data: habitIds.map((habitId, position) => ({ routineId, habitId, position })),
    });
  }

  private async assertHabits(habitIds: string[]) {
    if (new Set(habitIds).size !== habitIds.length) {
      throw new BadRequestException("A habit can be in a routine only once");
    }
    const found = await this.prisma.habit.count({
      where: { id: { in: habitIds }, archivedAt: null },
    });
    if (found !== habitIds.length) {
      throw new BadRequestException("Every habit in a routine must be an active habit");
    }
  }

  private async routine(id: string) {
    const routine = await this.prisma.routine.findUnique({ where: { id } });
    if (!routine) throw new NotFoundException(`Routine ${id} not found`);
    return routine;
  }
}
