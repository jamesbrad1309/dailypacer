import { Injectable } from "@nestjs/common";
import { PrismaService } from "#common/database/prisma.service";
import { shiftMonth } from "#finance/budget-math.util";
import { BudgetsService } from "#finance/budgets.service";
import { toIsoDate } from "#finance/calendar.util";
import { type LifeLevel, lifeLevel } from "#finance/life-xp.util";
import { SavingsGoalsService } from "#finance/savings-goals.service";
import { HabitStatsService } from "#habits/habit-stats.service";

/** Finished months looked back over for "under budget" XP. */
const BUDGET_MONTHS = 12;

/** Sources that count as keeping up with the money: by hand or from a bank file. */
const LOGGED_SOURCES = ["quick", "form", "import"];

/**
 * The LifeOS level: habit points plus finance XP (life-xp.util.ts). Lives
 * in finance because finance may read habits, never the other way round.
 */
@Injectable()
export class LifeLevelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgets: BudgetsService,
    private readonly goals: SavingsGoalsService,
    private readonly habitStats: HabitStatsService,
  ) {}

  async level(today: string): Promise<LifeLevel> {
    const [habits, underBudget, goals, loggedWeeks] = await Promise.all([
      this.habitStats.dashboardStats(),
      this.underBudget(today),
      this.goals.list(today, true),
      this.loggedWeeks(today),
    ]);
    return lifeLevel(habits.totalPoints, {
      underBudget,
      goalsReached: goals.filter((g) => g.achieved).length,
      loggedWeeks,
    });
  }

  /**
   * Budgeted categories that ended a month within budget, over the last
   * finished months from the first budget on. The month in progress
   * doesn't count until it's over.
   */
  private async underBudget(today: string): Promise<number> {
    const first = await this.prisma.budget.findFirst({ orderBy: { month: "asc" } });
    if (!first) return 0;
    const firstMonth = toIsoDate(first.month).slice(0, 7);
    const lastFinished = shiftMonth(today.slice(0, 7), -1);
    const months: string[] = [];
    for (let back = 0; back < BUDGET_MONTHS; back++) {
      const month = shiftMonth(lastFinished, -back);
      if (month < firstMonth) break;
      months.push(month);
    }
    const reports = await Promise.all(months.map((month) => this.budgets.report(month, today)));
    return reports.reduce(
      (sum, report) =>
        sum + report.lines.filter((l) => l.availableMinor > 0 && l.remainingMinor >= 0).length,
      0,
    );
  }

  /** Distinct weeks (Monday-based) with a transaction logged by hand or imported. */
  private async loggedWeeks(today: string): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ weeks: bigint }[]>`
      SELECT count(DISTINCT date_trunc('week', "date")) AS weeks
      FROM "transactions"
      WHERE "source" = ANY(${LOGGED_SOURCES}) AND "date" <= ${today}::date`;
    return Number(row?.weeks ?? 0);
  }
}
