import { useMutation } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";
import { Checkbox } from "#components/ui/checkbox";
import {
  DASHBOARD_STATS_QUERY,
  HABITS_QUERY,
  HABIT_PROGRESS_REFETCH,
  UPSERT_HABIT_ENTRY_MUTATION,
} from "#graphql/habits";
import type { Habit } from "#graphql/types";
import { useStreakCelebration } from "#hooks/useStreakCelebration";
import { todayIsoDate } from "#lib/dates";
import { isDoneToday } from "#lib/habit-today";

/**
 * Today's tick for one habit, wherever it's shown: a checkbox, or for an
 * avoid habit a "Slipped" toggle (it's done unless you slipped). Checking a
 * habit off can celebrate a streak milestone.
 */
export function HabitCheck({ habit, id }: { habit: Habit; id?: string }) {
  const { t } = useTranslation();
  const arm = useStreakCelebration(habit);
  const [upsertEntry] = useMutation(UPSERT_HABIT_ENTRY_MUTATION, {
    refetchQueries: [
      { query: HABITS_QUERY },
      { query: DASHBOARD_STATS_QUERY },
      ...HABIT_PROGRESS_REFETCH,
    ],
  });
  const entry = habit.todayEntry;
  const save = (input: { completed: boolean; value?: number }) =>
    upsertEntry({ variables: { input: { habitId: habit.id, date: todayIsoDate(), ...input } } });

  if (habit.polarity === "AVOID") {
    const slipped = !isDoneToday(habit);
    return (
      <Button
        id={id}
        size="sm"
        variant={slipped ? "destructive" : "outline"}
        className="h-7 px-2 text-xs"
        aria-pressed={slipped}
        aria-label={t("habits.card.slipFor", { name: habit.name })}
        onClick={() => save({ completed: false, value: slipped ? 0 : 1 })}
      >
        {slipped ? t("habits.card.slipped") : t("habits.card.slip")}
      </Button>
    );
  }
  return (
    <Checkbox
      id={id}
      checked={entry?.completed ?? false}
      aria-label={t("habits.card.doneToday", { name: habit.name })}
      onCheckedChange={(checked) => {
        if (checked === true) arm();
        save({ completed: checked === true, value: entry?.value ?? undefined });
      }}
    />
  );
}
