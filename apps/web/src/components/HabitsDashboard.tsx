import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArchivedHabits } from "#components/ArchivedHabits";
import { CreateHabitDialog } from "#components/CreateHabitDialog";
import { HabitList } from "#components/HabitList";
import { StatTiles } from "#components/StatTiles";
import { HABITS_QUERY } from "#graphql/habits";
import type { HabitsData } from "#graphql/types";
import { cn } from "#lib/utils";

export function HabitsDashboard() {
  const { t } = useTranslation();
  const { data } = useQuery<HabitsData>(HABITS_QUERY);
  const count = data?.habits.length;
  const allTags = [...new Set(data?.habits.flatMap((habit) => habit.tags) ?? [])].sort();
  const [tag, setTag] = useState<string | null>(null);
  // A tag can disappear (its last habit edited or archived); fall back to all.
  const activeTag = tag && allTags.includes(tag) ? tag : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Sunday and Monday: the week's review is ready. */}
      {[0, 1].includes(new Date().getDay()) && (count ?? 0) > 0 && (
        <Link
          to="/habits/review"
          className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm hover:bg-primary/10"
        >
          <ClipboardCheck className="size-4 text-primary" aria-hidden />
          <span className="flex-1">{t("habits.review.banner")}</span>
          <span className="font-medium text-primary">{t("habits.review.bannerAction")} →</span>
        </Link>
      )}
      <StatTiles />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {t("habits.yourHabits")}
            {count !== undefined && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">{count}</span>
            )}
          </h2>
          <CreateHabitDialog />
        </div>
        {allTags.length > 0 && (
          <fieldset className="flex flex-wrap items-center gap-1.5">
            <legend className="sr-only">{t("habits.filter.label")}</legend>
            <TagChip active={activeTag === null} onClick={() => setTag(null)}>
              {t("habits.filter.all")}
            </TagChip>
            {allTags.map((name) => (
              <TagChip
                key={name}
                active={activeTag === name}
                onClick={() => setTag(activeTag === name ? null : name)}
              >
                #{name}
              </TagChip>
            ))}
          </fieldset>
        )}
        <HabitList tag={activeTag} onTagClick={setTag} />
        <ArchivedHabits />
      </section>
    </div>
  );
}

function TagChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
