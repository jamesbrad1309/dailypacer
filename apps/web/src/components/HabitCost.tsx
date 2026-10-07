import { useQuery } from "@apollo/client/react";
import { Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HABIT_PAGE_FETCH, HABIT_SPEND_QUERY } from "#graphql/habits";
import type { Habit, HabitSpend } from "#graphql/types";
import { todayIsoDate } from "#lib/dates";
import { formatMoney } from "#lib/money";

/**
 * What a habit's linked spending costs: this month against last, and for a
 * build habit ("Gym") the cost per check-in this month. One query for every
 * card (Apollo shares it), see docs/finance/habits-integration.md §3.
 */
export function HabitCost({ habit }: { habit: Habit }) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const { data } = useQuery<{ habitSpend: HabitSpend[] }>(HABIT_SPEND_QUERY, {
    ...HABIT_PAGE_FETCH,
    variables: { today },
    skip: habit.financeCategoryIds.length === 0,
  });
  const spend = data?.habitSpend.find((s) => s.habitId === habit.id);
  if (!spend) return null;

  const money = (minor: number) => formatMoney(minor, spend.currency);
  const month = today.slice(0, 7);
  const checkIns = habit.heatmap.filter(
    (d) => d.date.startsWith(month) && d.status === "DONE",
  ).length;
  const perCheckIn =
    habit.polarity === "BUILD" && checkIns > 0 && spend.thisMonthMinor > 0
      ? Math.round(spend.thisMonthMinor / checkIns)
      : null;

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <Wallet className="size-3.5" aria-hidden />
      <span>
        {t("habits.cost.thisMonth", { amount: money(spend.thisMonthMinor) })} ·{" "}
        {t("habits.cost.lastMonth", { amount: money(spend.lastMonthMinor) })}
      </span>
      {perCheckIn !== null && (
        <span>· {t("habits.cost.perCheckIn", { amount: money(perCheckIn) })}</span>
      )}
    </p>
  );
}
