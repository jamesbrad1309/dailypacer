import { useTranslation } from "react-i18next";
import type { Habit, HabitCorrelation } from "#graphql/types";

const percent = (rate: number) => `${Math.round(rate * 100)}%`;
const number = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: value >= 10 ? 0 : 1 });

/**
 * Correlations as sentences: "On days you Exercise, you Sleep well 80% of
 * the time, against 45% otherwise", or for a habit with a unit "…, Sleep
 * averages 7.5 h, against 6.8 h". Patterns, not causes; the day counts back
 * each one up.
 */
export function HabitCorrelations({
  correlations,
  habits,
}: {
  correlations: HabitCorrelation[];
  habits: Pick<Habit, "id" | "name" | "unit">[];
}) {
  const { t } = useTranslation();
  const byId = new Map(habits.map((h) => [h.id, h]));
  const shown = correlations.filter((c) => byId.has(c.habitId) && byId.has(c.otherId));
  if (shown.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("habits.correlations.none")}</p>;
  }
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {shown.map((c) => {
        const a = byId.get(c.habitId) as Habit;
        const b = byId.get(c.otherId) as Habit;
        const sentence =
          c.kind === "RATE"
            ? t("habits.correlations.rate", {
                a: a.name,
                b: b.name,
                with: percent(c.withValue),
                without: percent(c.withoutValue),
              })
            : t("habits.correlations.value", {
                a: a.name,
                b: b.name,
                with: `${number(c.withValue)} ${b.unit ?? ""}`.trim(),
                without: `${number(c.withoutValue)} ${b.unit ?? ""}`.trim(),
              });
        return (
          <li key={`${c.habitId}-${c.otherId}`} className="flex flex-col">
            <span>{sentence}</span>
            <span className="text-xs text-muted-foreground">
              {t("habits.correlations.days", { with: c.daysWith, without: c.daysWithout })}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
