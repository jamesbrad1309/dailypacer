import { useEffect, useRef } from "react";
import { celebrate, crossedMilestone } from "#lib/celebrate";

/**
 * Celebrates a streak milestone (7, 30, 100 days) the moment the user's own
 * check-in reaches it. Call the returned `arm()` just before checking a
 * habit off; when the refetched streak crosses a milestone, the app-wide
 * celebration shows. Streaks that change for any other reason don't
 * celebrate (loading the page, another device).
 */
export function useStreakCelebration(habit: { name: string; currentStreak: number }) {
  const before = useRef<number | null>(null);
  useEffect(() => {
    if (before.current === null || before.current === habit.currentStreak) return;
    const milestone = crossedMilestone(before.current, habit.currentStreak);
    before.current = null;
    if (milestone) celebrate({ habitName: habit.name, days: milestone });
  }, [habit.currentStreak, habit.name]);
  return () => {
    before.current = habit.currentStreak;
  };
}
