import { BadRequestException, Injectable } from "@nestjs/common";
import { achievements } from "#habits/achievements.util";
import { challengeProgress } from "#habits/challenge.util";
import { correlations } from "#habits/correlations.util";
import { dayCells } from "#habits/day-status.util";
import { type Day, addDays, startOfWeek } from "#habits/day.util";
import { HabitHistoryService } from "#habits/habit-history.service";
import { HabitStatsService } from "#habits/habit-stats.service";
import { HabitsService } from "#habits/habits.service";
import { habitProgress } from "#habits/progress.util";
import { weeklyReview } from "#habits/weekly-review.util";

/** Widest range the week/month calendar asks for: a month grid plus padding. */
const MAX_CALENDAR_DAYS = 62;
/** How far back correlations look. */
const CORRELATION_DAYS = 90;

const span = (from: Day, to: Day) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/**
 * Read-only views across habits, all built on per-day statuses
 * (day-status.util): the week/month calendar, the weekly review,
 * achievements and correlations.
 */
@Injectable()
export class HabitReviewService {
  constructor(
    private readonly habitsService: HabitsService,
    private readonly history: HabitHistoryService,
    private readonly stats: HabitStatsService,
  ) {}

  /** Every active habit's day statuses from `from` to `to`. */
  async calendar(from: Day, to: Day, today: Day) {
    const days = span(from, to);
    if (days < 0 || days > MAX_CALENDAR_DAYS) {
      throw new BadRequestException(`from..to must span 0–${MAX_CALENDAR_DAYS} days`);
    }
    const habits = await this.habitsService.findAll();
    const histories = await this.history.load(habits, from, today);
    return histories.map((h) => ({
      habitId: h.habit.id,
      days: dayCells(h.days, from, to, today),
    }));
  }

  /** The Monday–Sunday week from `weekStart`, against the week before. */
  async weekly(weekStart: Day, today: Day) {
    if (startOfWeek(weekStart) !== weekStart) {
      throw new BadRequestException("weekStart must be a Monday");
    }
    const from = addDays(weekStart, -7);
    const habits = await this.habitsService.findAll();
    const [histories, stats] = await Promise.all([
      this.history.load(habits, from, today),
      this.stats.statsFor(habits.map((h) => h.id)),
    ]);
    return weeklyReview(
      histories.map((h) => ({
        id: h.habit.id,
        name: h.habit.name,
        schedule: h.schedule,
        currentStreak: stats.find((s) => s.habitId === h.habit.id)?.currentStreak ?? 0,
        cells: dayCells(h.days, from, addDays(weekStart, 6), today),
      })),
      weekStart,
      today,
    );
  }

  /** Badges from every habit's whole history, archived ones included. */
  async achievements(today: Day) {
    const [all, dashboard] = await Promise.all([
      this.habitsService
        .findAll()
        .then(async (active) => [...active, ...(await this.habitsService.findArchived())]),
      this.stats.dashboardStats(),
    ]);
    const histories = await this.history.load(all, null, today);
    const challengeWins = histories
      .flatMap((h) =>
        h.challenges.flatMap((c) => {
          if (challengeProgress(c, h.successDays, today).status !== "WON") return [];
          // The day the target was met: its target-th check-in in the range.
          const inRange = [...h.successDays]
            .filter((d) => d >= c.startDate && d <= c.endDate)
            .sort();
          return [inRange[c.target - 1]];
        }),
      )
      .sort();
    return achievements({
      habits: histories.map((h) => ({ cells: dayCells(h.days, h.since, today, today) })),
      level: dashboard.level,
      challengeWins,
      today,
    });
  }

  /** Active habits week by week over the last `weeks` Monday–Sunday weeks, this one included. */
  async progress(weeks: number, today: Day) {
    const firstMonday = addDays(startOfWeek(today), -7 * (weeks - 1));
    const habits = await this.habitsService.findAll();
    const histories = await this.history.load(habits, firstMonday, today);
    return habitProgress(
      histories.map((h) => ({
        id: h.habit.id,
        name: h.habit.name,
        schedule: h.schedule,
        cells: dayCells(h.days, firstMonday, today, today),
      })),
      firstMonday,
      weeks,
      today,
    );
  }

  /** Pairs of active habits that go together over the last 90 days. */
  async correlations(today: Day) {
    const from = addDays(today, -CORRELATION_DAYS);
    const habits = await this.habitsService.findAll();
    const histories = await this.history.load(habits, from, today);
    return correlations(
      histories.map((h) => ({
        id: h.habit.id,
        name: h.habit.name,
        quantified: Boolean(h.habit.unit) && h.habit.polarity !== "avoid",
        cells: dayCells(h.days, from, today, today),
      })),
      today,
    );
  }
}
