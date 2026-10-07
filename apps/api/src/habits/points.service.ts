import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { challengeBonus, challengeProgress } from "#habits/challenge.util";
import { addDays, type Day, toDay } from "#habits/day.util";
import { dayStatus } from "#habits/day-status.util";
import type { ChallengeInput, FreezeInput, RewardInput } from "#habits/dto/motivation.dto";
import { FREEZE_COST, FREEZE_WINDOW_DAYS, POINTS_PER_CHECK_IN } from "#habits/gamification.util";
import { HabitHistoryService, toChallenge } from "#habits/habit-history.service";
import { HabitsService } from "#habits/habits.service";

const log = scopedLogger("PointsService");

/** How long an ended challenge stays listed. */
const ENDED_CHALLENGE_DAYS = 14;

/**
 * The points wallet: earned from every check-in ever (10 each, plus won
 * challenges' bonus), spent on rewards and streak freezes. Unlike the
 * level, which comes from the last 120 days, the balance never goes down
 * except by spending, and spending never lowers the level.
 */
@Injectable()
export class PointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly habitsService: HabitsService,
    private readonly history: HabitHistoryService,
  ) {}

  async wallet(today: Day) {
    const [earned, spent, spends] = await Promise.all([
      this.earned(today),
      this.prisma.pointsSpend.aggregate({ _sum: { points: true } }),
      this.prisma.pointsSpend.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    ]);
    const spentPoints = spent._sum.points ?? 0;
    return {
      earned,
      spent: spentPoints,
      balance: earned - spentPoints,
      freezeCost: FREEZE_COST,
      spends,
    };
  }

  /** Every habit's check-ins ever, archived ones included, plus won challenges' bonus. */
  async earned(today: Day): Promise<number> {
    const habits = await this.prisma.habit.findMany();
    const histories = await this.history.load(habits, null, today);
    return histories.reduce(
      (sum, h) =>
        sum +
        h.successDays.size * POINTS_PER_CHECK_IN +
        challengeBonus(h.challenges, h.successDays, today),
      0,
    );
  }

  // ─── Rewards ────────────────────────────────────────────────────────────

  rewards() {
    return this.prisma.reward.findMany({
      where: { archivedAt: null },
      orderBy: [{ cost: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { spends: true } } },
    });
  }

  async createReward(input: RewardInput) {
    const reward = await this.prisma.reward.create({
      data: { ...input, emoji: input.emoji ?? null },
    });
    log.info({ rewardId: reward.id }, "reward created");
    return { ...reward, _count: { spends: 0 } };
  }

  async updateReward(id: string, input: RewardInput) {
    await this.reward(id);
    return this.prisma.reward.update({
      where: { id },
      data: input,
      include: { _count: { select: { spends: true } } },
    });
  }

  /** Removes it from the shop; past redemptions keep their label. */
  async archiveReward(id: string) {
    await this.reward(id);
    await this.prisma.reward.update({ where: { id }, data: { archivedAt: new Date() } });
    return { id };
  }

  async redeem(id: string, today: Day) {
    const reward = await this.reward(id);
    await this.assertAffordable(reward.cost, today);
    const spend = await this.prisma.pointsSpend.create({
      data: { points: reward.cost, kind: "reward", rewardId: id, label: reward.name },
    });
    log.info({ rewardId: id, points: reward.cost }, "reward redeemed");
    return spend;
  }

  /** Undoes a spend, refunding it; undoing a freeze unfreezes the day too. */
  async undoSpend(id: string) {
    const spend = await this.prisma.pointsSpend.findUnique({ where: { id } });
    if (!spend) throw new NotFoundException(`Spend ${id} not found`);
    if (spend.freezeId) await this.prisma.streakFreeze.delete({ where: { id: spend.freezeId } });
    else await this.prisma.pointsSpend.delete({ where: { id } });
    log.info({ spendId: id, kind: spend.kind }, "points spend undone");
    return { id };
  }

  // ─── Streak freezes ─────────────────────────────────────────────────────

  /**
   * Buys back a missed (or slipped) day from the last FREEZE_WINDOW_DAYS,
   * for FREEZE_COST points: it then counts as not due, so the streak
   * survives it. Today can't be frozen: it isn't over.
   */
  async freeze(habitId: string, { date, today }: FreezeInput) {
    const habit = await this.habitsService.findOneOrFail(habitId);
    if (date >= today) throw new BadRequestException("Only a past day can be frozen");
    if (date < addDays(today, -FREEZE_WINDOW_DAYS)) {
      throw new BadRequestException(`Only the last ${FREEZE_WINDOW_DAYS} days can be frozen`);
    }
    const [history] = await this.history.load([habit], date, today);
    const status = dayStatus(history.days, date, today);
    if (status !== "MISSED" && status !== "SLIPPED") {
      throw new BadRequestException("Only a missed day can be frozen");
    }
    await this.assertAffordable(FREEZE_COST, today);
    const freeze = await this.prisma.streakFreeze.create({
      data: {
        habitId,
        date: new Date(date),
        spend: {
          create: { points: FREEZE_COST, kind: "freeze", label: `${habit.name} · ${date}` },
        },
      },
    });
    log.info({ habitId, date }, "streak day frozen");
    return { id: freeze.id, habitId, date };
  }

  /** Unfreezes a day and refunds its points. */
  async unfreeze(habitId: string, date: Day) {
    await this.prisma.streakFreeze.deleteMany({ where: { habitId, date: new Date(date) } });
    return { habitId, date };
  }

  // ─── Challenges ─────────────────────────────────────────────────────────

  /** Challenges going on or coming up, and those that ended in the last two weeks, with progress. */
  async challenges(today: Day) {
    const rows = await this.prisma.habitChallenge.findMany({
      where: { endDate: { gte: new Date(addDays(today, -ENDED_CHALLENGE_DAYS)) } },
      include: { habit: true },
      orderBy: [{ endDate: "asc" }],
    });
    const habits = [...new Map(rows.map((r) => [r.habit.id, r.habit])).values()];
    const earliest = rows.reduce(
      (min, r) => (toDay(r.startDate) < min ? toDay(r.startDate) : min),
      today,
    );
    const histories = await this.history.load(habits, earliest, today);
    return rows.map((row) => {
      const h = histories.find((x) => x.habit.id === row.habitId);
      const challenge = toChallenge(row);
      return {
        ...challenge,
        habitId: row.habitId,
        habitName: row.habit.name,
        ...challengeProgress(challenge, h?.successDays ?? new Set(), today),
      };
    });
  }

  /**
   * Starts a challenge on a habit: `target` check-ins between two days (at
   * most 31 days, not ending in the past, one at a time per habit).
   */
  async createChallenge(habitId: string, input: ChallengeInput) {
    await this.habitsService.findOneOrFail(habitId);
    const { startDate, endDate, target, multiplier, today } = input;
    if (endDate < startDate) throw new BadRequestException("The challenge ends before it starts");
    if (endDate < today) throw new BadRequestException("The challenge has already ended");
    const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
    if (days > 31) throw new BadRequestException("A challenge lasts 31 days at most");
    if (target > days)
      throw new BadRequestException(`${target} check-ins don't fit in ${days} days`);
    const overlapping = await this.prisma.habitChallenge.count({
      where: {
        habitId,
        startDate: { lte: new Date(endDate) },
        endDate: { gte: new Date(startDate) },
      },
    });
    if (overlapping > 0) throw new BadRequestException("This habit already has a challenge then");
    const challenge = await this.prisma.habitChallenge.create({
      data: {
        habitId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        target,
        multiplier,
      },
    });
    log.info({ habitId, challengeId: challenge.id }, "challenge created");
    return (await this.challenges(today)).find((c) => c.id === challenge.id);
  }

  async deleteChallenge(id: string) {
    await this.prisma.habitChallenge.deleteMany({ where: { id } });
    return { id };
  }

  private async reward(id: string) {
    const reward = await this.prisma.reward.findUnique({ where: { id } });
    if (!reward || reward.archivedAt) throw new NotFoundException(`Reward ${id} not found`);
    return reward;
  }

  private async assertAffordable(cost: number, today: Day) {
    const { balance } = await this.wallet(today);
    if (balance < cost) {
      throw new BadRequestException(`That costs ${cost} points; you have ${balance}`);
    }
  }
}
