/** Average month length in days, for "per month" from a number of days. */
const DAYS_PER_MONTH = 30.4375;
const DAY_MS = 86_400_000;

export interface GoalShape {
  targetMinor: number;
  /** "YYYY-MM-DD" or null for no deadline. */
  deadline: string | null;
  /** "YYYY-MM-DD": progress is measured from this day… */
  startDate: string;
  /** …and from what was saved then. */
  startSavedMinor: number;
}

export interface GoalProgress {
  savedMinor: number;
  remainingMinor: number;
  /** saved / target, 0 or more (above 1 once beaten). */
  progress: number;
  achieved: boolean;
  /** The deadline has passed without reaching the target. */
  overdue: boolean;
  /** What to put aside each month from now to hit the deadline; null without one. */
  requiredPerMonthMinor: number | null;
  /**
   * Saved at least as much as a steady pace from the start would have by
   * today; null without a deadline.
   */
  onTrack: boolean | null;
  /** Where a steady pace would be by today; null without a deadline. */
  expectedMinor: number | null;
}

function days(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/**
 * A goal's progress on `today`. Without a deadline only the amounts apply.
 * With one: the monthly saving needed for what's left over the months left
 * (at least one, so the last weeks ask for the rest), and "on track" when
 * the saving since the start keeps up with the time gone since it.
 */
export function goalProgress(goal: GoalShape, savedMinor: number, today: string): GoalProgress {
  const remainingMinor = Math.max(0, goal.targetMinor - savedMinor);
  const achieved = savedMinor >= goal.targetMinor;
  const base = {
    savedMinor,
    remainingMinor,
    progress: goal.targetMinor > 0 ? Math.max(0, savedMinor) / goal.targetMinor : 0,
    achieved,
  };
  if (!goal.deadline) {
    return {
      ...base,
      overdue: false,
      requiredPerMonthMinor: null,
      onTrack: null,
      expectedMinor: null,
    };
  }

  const daysLeft = days(today, goal.deadline);
  const total = days(goal.startDate, goal.deadline);
  const share = total <= 0 ? 1 : Math.min(1, Math.max(0, days(goal.startDate, today) / total));
  const expectedMinor = Math.round(
    goal.startSavedMinor + (goal.targetMinor - goal.startSavedMinor) * share,
  );
  if (achieved) {
    return { ...base, overdue: false, requiredPerMonthMinor: 0, onTrack: true, expectedMinor };
  }
  const overdue = daysLeft < 0;
  const monthsLeft = Math.max(1, daysLeft / DAYS_PER_MONTH);
  return {
    ...base,
    overdue,
    requiredPerMonthMinor: overdue ? remainingMinor : Math.ceil(remainingMinor / monthsLeft),
    onTrack: !overdue && savedMinor >= expectedMinor,
    expectedMinor,
  };
}
