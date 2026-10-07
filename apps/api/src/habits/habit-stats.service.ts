import { Injectable } from "@nestjs/common";
import { challengeBonus } from "#habits/challenge.util";
import { addDays, toDay } from "#habits/day.util";
import { type DayStatus, dayStatus } from "#habits/day-status.util";
import {
  computeLevel,
  computePoints,
  levelTitle,
  pointsRequiredForLevel,
} from "#habits/gamification.util";
import { type HabitHistory, HabitHistoryService } from "#habits/habit-history.service";
import { HabitsService } from "#habits/habits.service";
import {
  computeCurrentStreak,
  computeLongestStreak,
  computeTotalCompletions,
} from "#habits/streak.util";

/**
 * How far back streaks/points/heatmaps look. A longer window makes
 * "longest streak" and the heatmap more meaningful but costs a bigger row
 * scan per request — 120 days (~4 months) is a reasonable trade-off for a
 * personal habit tracker; see docs/domain/use-cases.md.
 */
export const STATS_WINDOW_DAYS = 120;

export interface HeatmapDay {
  date: string;
  completed: boolean;
  value: number | null;
  /** How the day went (done, missed, frozen, slipped…): see day-status.util. */
  status: DayStatus;
}

export interface HabitStats {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  /** Includes bonus points from won challenges. */
  points: number;
  level: number;
  levelTitle: string;
  /** One entry per day in the stats window, oldest first. */
  heatmap: HeatmapDay[];
}

/**
 * Derived per-habit and dashboard stats. These used to be computed inside
 * GraphQL field resolvers; they live here now so the domain rules stay in
 * the API and the BFF only shapes and batches data (see
 * docs/backend/graphql-bff.md). Avoid habits count their clean days as
 * check-ins (habit-history.service.ts), and won challenges add points.
 */
@Injectable()
export class HabitStatsService {
  constructor(
    private readonly habitsService: HabitsService,
    private readonly history: HabitHistoryService,
  ) {}

  /** Stats for many habits with one load — the BFF batches field requests into this. */
  async statsFor(habitIds: readonly string[]): Promise<HabitStats[]> {
    const habits = await this.habitsService.findManyByIds(habitIds);
    const today = new Date();
    const todayDay = toDay(today);
    const histories = await this.history.load(
      habits,
      addDays(todayDay, -STATS_WINDOW_DAYS),
      todayDay,
    );
    return histories.map((h) => this.computeStats(h, today));
  }

  async dashboardStats() {
    const habits = await this.habitsService.findAll();
    const perHabit = await this.statsFor(habits.map((habit) => habit.id));

    const totalPoints = perHabit.reduce((sum, s) => sum + s.points, 0);
    const level = computeLevel(totalPoints);

    return {
      totalHabits: habits.length,
      pausedHabits: habits.filter((h) => h.pausedAt != null).length,
      totalPoints,
      level,
      levelTitle: levelTitle(level),
      pointsIntoLevel: totalPoints - pointsRequiredForLevel(level),
      pointsForNextLevel: pointsRequiredForLevel(level + 1) - pointsRequiredForLevel(level),
      longestOverallStreak: perHabit.reduce((max, s) => Math.max(max, s.longestStreak), 0),
      activeStreakCount: perHabit.filter((s) => s.currentStreak > 0).length,
    };
  }

  private computeStats(h: HabitHistory, today: Date): HabitStats {
    const todayDay = toDay(today);
    const args = [
      h.schedule,
      h.effective,
      h.targetValue,
      today,
      STATS_WINDOW_DAYS,
      h.notDue,
    ] as const;
    const currentStreak = computeCurrentStreak(...args);
    const longestStreak = computeLongestStreak(...args);
    const totalCompletions = computeTotalCompletions(h.effective, h.targetValue);
    const points = computePoints(
      totalCompletions,
      currentStreak,
      challengeBonus(h.challenges, h.successDays, todayDay),
    );
    const level = computeLevel(points);
    const avoid = h.habit.polarity === "avoid";

    const heatmap: HeatmapDay[] = [];
    for (let offset = STATS_WINDOW_DAYS - 1; offset >= 0; offset--) {
      const key = addDays(todayDay, -offset);
      const entry = h.days.entries.get(key);
      heatmap.push({
        date: key,
        completed: avoid ? h.successDays.has(key) : (entry?.completed ?? false),
        value: entry?.value ?? null,
        status: dayStatus(h.days, key, todayDay),
      });
    }

    return {
      habitId: h.habit.id,
      currentStreak,
      longestStreak,
      totalCompletions,
      points,
      level,
      levelTitle: levelTitle(level),
      heatmap,
    };
  }
}
