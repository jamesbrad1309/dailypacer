import { useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { HabitCard } from "#components/HabitCard";
import { HabitCardsSkeleton } from "#components/layout/Skeletons";
import { HABIT_PAGE_FETCH, HABITS_QUERY } from "#graphql/habits";
import type { HabitsData } from "#graphql/types";

interface Props {
  /** Only habits carrying this tag; all of them when null. */
  tag?: string | null;
  onTagClick?: (tag: string) => void;
}

export function HabitList({ tag = null, onTagClick }: Props) {
  const { t } = useTranslation();
  const { data, loading, error } = useQuery<HabitsData>(HABITS_QUERY, HABIT_PAGE_FETCH);

  if (loading && !data) return <HabitCardsSkeleton />;
  if (error) return <p className="text-destructive">{error.message}</p>;
  if (!data?.habits.length) {
    return <p className="text-muted-foreground">{t("habits.none")}</p>;
  }

  const habits = tag ? data.habits.filter((habit) => habit.tags.includes(tag)) : data.habits;
  if (habits.length === 0) {
    return <p className="text-muted-foreground">{t("habits.filter.none", { tag })}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {habits.map((habit) => (
        <HabitCard key={habit.id} habit={habit} onTagClick={onTagClick} />
      ))}
    </div>
  );
}
