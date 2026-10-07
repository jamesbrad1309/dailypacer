import { useMutation, useQuery } from "@apollo/client/react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ListSkeleton } from "#components/layout/Skeletons";
import { Button } from "#components/ui/button";
import {
  ARCHIVED_HABITS_QUERY,
  DASHBOARD_STATS_QUERY,
  HABITS_QUERY,
  UNARCHIVE_HABIT_MUTATION,
} from "#graphql/habits";
import type { ArchivedHabitsData } from "#graphql/types";
import { useStoredState } from "#hooks/useStoredState";
import { formatDaysAgo } from "#lib/dates";
import { cn } from "#lib/utils";

/** Collapsed by default; archived habits are only fetched once it's opened. */
export function ArchivedHabits() {
  const { t } = useTranslation();
  const [open, setOpen] = useStoredState("dailypacer.habits.showArchived", false);
  const { data, loading, error } = useQuery<ArchivedHabitsData>(ARCHIVED_HABITS_QUERY, {
    skip: !open,
  });
  // Restoring moves a habit between two lists, and changes the dashboard's
  // totals — none of which cache normalization can infer.
  const [unarchive, { loading: restoring }] = useMutation(UNARCHIVE_HABIT_MUTATION, {
    refetchQueries: [
      { query: HABITS_QUERY },
      { query: ARCHIVED_HABITS_QUERY },
      { query: DASHBOARD_STATS_QUERY },
    ],
  });

  const habits = data?.archivedHabits ?? [];

  return (
    <section className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="self-start text-muted-foreground"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
        {t("habits.archived.title")}
      </Button>

      {open &&
        (loading ? (
          <ListSkeleton rows={2} />
        ) : error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : !habits.length ? (
          <p className="text-sm text-muted-foreground">{t("habits.archived.none")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {habits.map((habit) => (
              <li key={habit.id} className="flex items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {habit.icon && <span className="mr-1.5">{habit.icon}</span>}
                    {habit.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t("habits.archived.when", { when: formatDaysAgo(habit.archivedAt) })}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={restoring}
                  onClick={() => unarchive({ variables: { id: habit.id } })}
                >
                  <RotateCcw className="size-3.5" /> {t("common.restore")}
                </Button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
