/**
 * Streak milestones (7, 30, 100 days) and the celebration they show. A tiny
 * external store like lib/toast.ts, so the card that crossed the line can
 * raise it and the app shell shows it.
 */

export const STREAK_MILESTONES = [7, 30, 100] as const;

export interface Celebration {
  habitName: string;
  days: number;
}

let current: Celebration | null = null;
const listeners = new Set<() => void>();

export function subscribeCelebration(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCelebration(): Celebration | null {
  return current;
}

export function celebrate(celebration: Celebration | null): void {
  current = celebration;
  for (const listener of listeners) listener();
}

/** The milestone a streak just reached going from `before` to `after`, if any. */
export function crossedMilestone(before: number, after: number): number | null {
  return [...STREAK_MILESTONES].reverse().find((m) => before < m && after >= m) ?? null;
}
