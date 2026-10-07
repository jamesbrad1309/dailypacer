import { computeLevel, levelTitle, pointsRequiredForLevel } from "#habits/gamification.util";

/**
 * Finance's share of the DailyPacer level (docs/finance/habits-integration.md
 * §4). Like habit points it's derived, never stored: the counts come from
 * budgets, goals and transactions on every read.
 */
export const XP_UNDER_BUDGET = 25;
export const XP_GOAL_REACHED = 100;
export const XP_LOGGED_WEEK = 10;

export interface FinanceCounts {
  /** Budgeted categories that finished a month within their budget. */
  underBudget: number;
  /** Savings goals at or past their target. */
  goalsReached: number;
  /** Weeks with at least one transaction logged by hand or imported. */
  loggedWeeks: number;
}

export interface LifeLevel extends FinanceCounts {
  habitXp: number;
  budgetXp: number;
  goalXp: number;
  loggingXp: number;
  financeXp: number;
  totalXp: number;
  level: number;
  levelTitle: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

/** Habit points plus finance XP, on the habits' level curve (gamification.util.ts). */
export function lifeLevel(habitXp: number, counts: FinanceCounts): LifeLevel {
  const budgetXp = counts.underBudget * XP_UNDER_BUDGET;
  const goalXp = counts.goalsReached * XP_GOAL_REACHED;
  const loggingXp = counts.loggedWeeks * XP_LOGGED_WEEK;
  const financeXp = budgetXp + goalXp + loggingXp;
  const totalXp = habitXp + financeXp;
  const level = computeLevel(totalXp);
  return {
    ...counts,
    habitXp,
    budgetXp,
    goalXp,
    loggingXp,
    financeXp,
    totalXp,
    level,
    levelTitle: levelTitle(level),
    xpIntoLevel: totalXp - pointsRequiredForLevel(level),
    xpForNextLevel: pointsRequiredForLevel(level + 1) - pointsRequiredForLevel(level),
  };
}
