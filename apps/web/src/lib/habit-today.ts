import type { Habit } from "#graphql/types";

/** Done today: checked off, or (an avoid habit) not slipped. */
export function isDoneToday(habit: Pick<Habit, "polarity" | "todayEntry">): boolean {
  const entry = habit.todayEntry;
  if (habit.polarity === "AVOID") return !(entry && !entry.completed && (entry.value ?? 0) > 0);
  return entry?.completed ?? false;
}
