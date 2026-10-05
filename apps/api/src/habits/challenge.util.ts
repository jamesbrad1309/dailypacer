import { type Day, addDays } from "#habits/day.util";
import { POINTS_PER_CHECK_IN } from "#habits/gamification.util";

export interface ChallengeLike {
  startDate: Day;
  endDate: Day;
  /** Check-ins needed between the two days (both included). */
  target: number;
  /** Met, each check-in in the range earns this many times its points. */
  multiplier: number;
}

export type ChallengeStatus = "UPCOMING" | "ACTIVE" | "WON" | "LOST";

export interface ChallengeProgress {
  done: number;
  status: ChallengeStatus;
  /** Extra points earned by meeting it (0 until it's met). */
  bonusPoints: number;
}

/**
 * How a challenge stands on `today`: check-ins so far in its range, and
 * whether it's won (target met, even before it ends), lost (ended short) or
 * still going. A won challenge's check-ins earn (multiplier − 1) × their
 * normal points on top.
 */
export function challengeProgress(
  challenge: ChallengeLike,
  successDays: ReadonlySet<Day>,
  today: Day,
): ChallengeProgress {
  let done = 0;
  for (let day = challenge.startDate; day <= challenge.endDate; day = addDays(day, 1)) {
    if (successDays.has(day)) done++;
  }
  const won = done >= challenge.target;
  const status: ChallengeStatus = won
    ? "WON"
    : today > challenge.endDate
      ? "LOST"
      : today < challenge.startDate
        ? "UPCOMING"
        : "ACTIVE";
  const bonusPoints = won ? Math.round((challenge.multiplier - 1) * POINTS_PER_CHECK_IN * done) : 0;
  return { done, status, bonusPoints };
}

/** The bonus points every won challenge adds. */
export function challengeBonus(
  challenges: readonly ChallengeLike[],
  successDays: ReadonlySet<Day>,
  today: Day,
): number {
  return challenges.reduce(
    (sum, c) => sum + challengeProgress(c, successDays, today).bonusPoints,
    0,
  );
}
