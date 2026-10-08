import { Injectable } from "@nestjs/common";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { AccountsService } from "#finance/accounts.service";
import { BudgetsService } from "#finance/budgets.service";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import { SavingsGoalsService } from "#finance/savings-goals.service";
import { SubscriptionsService } from "#finance/subscriptions.service";
import { UNCATEGORISED } from "#finance/transactions.service";
import { addDays, type Day } from "#habits/day.util";
import { dayCells } from "#habits/day-status.util";
import { HabitHistoryService } from "#habits/habit-history.service";
import { HabitReviewService } from "#habits/habit-review.service";
import { HabitStatsService } from "#habits/habit-stats.service";
import { HabitsService } from "#habits/habits.service";
import { PointsService } from "#habits/points.service";
import { type Candidate, ONGOING_KINDS } from "#notifications/notification.util";

const log = scopedLogger("NotificationSources");

/** A card payment is flagged this many days ahead, as on Money setup. */
const CARD_DUE_DAYS = 7;
/** From this time of day, a due habit with a streak going is at risk. */
const STREAK_RISK_TIME = "20:00";
/** A streak this long is worth guarding. */
const STREAK_RISK_MIN = 3;
const STREAK_MILESTONES = new Set([7, 14, 30, 50, 100, 200, 365]);
/** Badges and wins older than this aren't news: a first sync doesn't replay history. */
const RECENT_DAYS = 7;

/** What the sources see: the user's local day and time. */
export interface SyncClock {
  today: Day;
  /** "HH:mm", 24h. */
  time: string;
}

interface SourceResult {
  candidates: Candidate[];
  /** The ongoing kinds this source speaks for: their absence means "no longer true". */
  kinds: string[];
}

/**
 * Where notifications come from: what's true now across tasks, money and
 * habits, as candidates (notification.util.ts). Each source runs on its
 * own; one that fails is logged and skipped, and resolves nothing.
 */
@Injectable()
export class NotificationSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: AccountsService,
    private readonly budgets: BudgetsService,
    private readonly goals: SavingsGoalsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly habits: HabitsService,
    private readonly history: HabitHistoryService,
    private readonly stats: HabitStatsService,
    private readonly review: HabitReviewService,
    private readonly points: PointsService,
  ) {}

  async collect(clock: SyncClock): Promise<{ candidates: Candidate[]; covered: Set<string> }> {
    const sources = {
      tasks: () => this.tasks(clock),
      money: () => this.money(clock),
      cards: () => this.cards(clock),
      habits: () => this.habitNudges(clock),
      achievements: () => this.achievements(clock),
    };
    const results = await Promise.all(
      Object.entries(sources).map(async ([name, run]) => {
        try {
          return await run();
        } catch (err) {
          log.error({ err, source: name }, "notification source failed");
          return null;
        }
      }),
    );
    const candidates: Candidate[] = [];
    const covered = new Set<string>();
    for (const result of results) {
      if (!result) continue;
      candidates.push(...result.candidates);
      for (const kind of result.kinds) if (ONGOING_KINDS.has(kind)) covered.add(kind);
    }
    return { candidates, covered };
  }

  /** Open tasks due today or overdue, and tasks waiting in the Inbox without a day. */
  private async tasks({ today }: SyncClock): Promise<SourceResult> {
    const [due, inbox] = await Promise.all([
      this.prisma.task.findMany({
        where: { status: { not: "DONE" }, dueOn: { lte: fromIsoDate(today) } },
        include: { list: { select: { prefix: true } } },
        orderBy: { dueOn: "asc" },
      }),
      this.prisma.todoList.findFirst({
        where: { isInbox: true },
        select: {
          id: true,
          _count: { select: { tasks: { where: { status: { not: "DONE" }, plannedFor: null } } } },
        },
      }),
    ]);
    const candidates: Candidate[] = due.map((task) => {
      const dueOn = toIsoDate(task.dueOn as Date);
      const kind = dueOn < today ? "task.overdue" : "task.dueToday";
      return {
        key: `task-due:${task.id}:${dueOn}`,
        kind,
        params: { title: task.title, taskKey: `${task.list.prefix}-${task.number}`, dueOn },
        link: `/tasks/lists/${task.listId}`,
        fingerprint: kind,
      };
    });
    const waiting = inbox?._count.tasks ?? 0;
    if (inbox && waiting > 0) {
      candidates.push({
        key: "tasks-inbox",
        kind: "task.inbox",
        params: { count: waiting },
        link: `/tasks/lists/${inbox.id}`,
        fingerprint: String(waiting),
        resurface: "grew",
      });
    }
    return { candidates, kinds: ["task.dueToday", "task.overdue", "task.inbox"] };
  }

  /** Spending to categorise, charges to confirm, budgets crossed and goals reached. */
  private async money({ today }: SyncClock): Promise<SourceResult> {
    const month = today.slice(0, 7);
    const [uncategorised, pending, report, goals] = await Promise.all([
      this.prisma.transaction.count({ where: UNCATEGORISED }),
      this.subscriptions.pendingCount(today),
      this.budgets.report(month, today),
      this.goals.list(today),
    ]);
    const candidates: Candidate[] = [];
    if (uncategorised > 0) {
      candidates.push({
        key: "money-to-review",
        kind: "money.toReview",
        params: { count: uncategorised },
        link: "/finance/transactions?view=review",
        fingerprint: String(uncategorised),
        resurface: "grew",
      });
    }
    if (pending > 0) {
      candidates.push({
        key: "money-pending-charges",
        kind: "money.pendingCharges",
        params: { count: pending },
        link: "/finance/transactions?view=review",
        fingerprint: String(pending),
        resurface: "grew",
      });
    }
    for (const line of report.lines) {
      if (!line.alert) continue;
      const category = line.category;
      const key = (category.metadata as { key?: string } | null)?.key ?? null;
      candidates.push({
        key: `budget:${category.id}:${month}:${line.alert}`,
        kind: "money.budget",
        params: {
          level: line.alert,
          category: { id: category.id, name: category.name, key, icon: category.icon },
          spentMinor: line.spentMinor,
          availableMinor: line.availableMinor,
          currency: report.currency,
          month,
        },
        link: `/finance/budgets?month=${month}`,
        fingerprint: line.alert,
      });
    }
    for (const goal of goals) {
      if (!goal.achieved) continue;
      candidates.push({
        key: `goal-reached:${goal.id}`,
        kind: "money.goalReached",
        params: { name: goal.name, emoji: goal.emoji, targetMinor: goal.targetMinor },
        link: "/finance/goals",
        fingerprint: "reached",
      });
    }
    return { candidates, kinds: ["money.toReview", "money.pendingCharges"] };
  }

  /** Card payments due within a week while something is owed. */
  private async cards({ today }: SyncClock): Promise<SourceResult> {
    const cards = await this.prisma.account.findMany({
      where: { type: "CREDIT_CARD", archivedAt: null },
      select: { id: true, name: true, currency: true },
    });
    const metrics = cards.length
      ? await this.accounts.metrics(
          cards.map((c) => c.id),
          fromIsoDate(today),
        )
      : [];
    const candidates: Candidate[] = [];
    for (const card of cards) {
      const m = metrics.find((x) => x.accountId === card.id);
      if (!m?.nextDueDate || m.balanceMinor >= 0) continue;
      if (m.nextDueDate > addDays(today, CARD_DUE_DAYS)) continue;
      candidates.push({
        key: `card-due:${card.id}:${m.nextDueDate}`,
        kind: "money.cardDue",
        params: {
          account: card.name,
          dueDate: m.nextDueDate,
          owedMinor: -m.balanceMinor,
          currency: card.currency,
        },
        link: "/finance/accounts",
        fingerprint: m.nextDueDate,
      });
    }
    return { candidates, kinds: ["money.cardDue"] };
  }

  /** A due habit past its start time, a streak at risk in the evening, and streak milestones. */
  private async habitNudges({ today, time }: SyncClock): Promise<SourceResult> {
    const habits = (await this.habits.findAll()).filter((h) => h.pausedAt === null);
    const [histories, stats] = await Promise.all([
      this.history.load(habits, addDays(today, -1), today),
      this.stats.statsFor(habits.map((h) => h.id)),
    ]);
    const candidates: Candidate[] = [];
    for (const h of histories) {
      const habit = h.habit;
      const status = dayCells(h.days, today, today, today)[0]?.status;
      const streak = stats.find((s) => s.habitId === habit.id)?.currentStreak ?? 0;
      const about = { habit: habit.name, icon: habit.icon, streak };
      const link = `/habits/${habit.id}`;
      if (status === "DUE" && habit.startTime && habit.startTime <= time) {
        candidates.push({
          key: `habit-due:${habit.id}:${today}`,
          kind: "habit.due",
          params: { ...about, startTime: habit.startTime },
          link,
          fingerprint: "due",
        });
      }
      if (status === "DUE" && time >= STREAK_RISK_TIME && streak >= STREAK_RISK_MIN) {
        candidates.push({
          key: `streak-risk:${habit.id}:${today}`,
          kind: "habit.streakAtRisk",
          params: about,
          link,
          fingerprint: "risk",
        });
      }
      if (status === "DONE" && STREAK_MILESTONES.has(streak)) {
        candidates.push({
          key: `streak:${habit.id}:${streak}:${today}`,
          kind: "habit.streakMilestone",
          params: about,
          link,
          fingerprint: String(streak),
        });
      }
    }
    return { candidates, kinds: ["habit.due", "habit.streakAtRisk"] };
  }

  /** Badges earned, level ups and challenges won, from the last week only. */
  private async achievements({ today }: SyncClock): Promise<SourceResult> {
    const since = addDays(today, -RECENT_DAYS);
    const [badges, dashboard, challenges] = await Promise.all([
      this.review.achievements(today),
      this.stats.dashboardStats(),
      this.points.challenges(today),
    ]);
    const candidates: Candidate[] = [];
    for (const badge of badges) {
      if (!badge.unlocked || !badge.achievedOn || badge.achievedOn < since) continue;
      candidates.push({
        key: `achievement:${badge.key}`,
        kind: "achievement.unlocked",
        params: { achievement: badge.key },
        link: "/habits/rewards",
        fingerprint: "unlocked",
      });
    }
    if (dashboard.level >= 2) {
      candidates.push({
        key: `level:${dashboard.level}`,
        kind: "achievement.levelUp",
        params: { level: dashboard.level, title: dashboard.levelTitle },
        link: "/progress",
        fingerprint: String(dashboard.level),
      });
    }
    for (const challenge of challenges) {
      if (challenge.status !== "WON" || challenge.endDate < since) continue;
      candidates.push({
        key: `challenge:${challenge.id}`,
        kind: "achievement.challengeWon",
        params: { habit: challenge.habitName, target: challenge.target },
        link: `/habits/${challenge.habitId}`,
        fingerprint: "won",
      });
    }
    return { candidates, kinds: [] };
  }
}
