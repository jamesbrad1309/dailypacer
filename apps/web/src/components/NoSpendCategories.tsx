import { useQuery } from "@apollo/client/react";
import { useTranslation } from "react-i18next";
import { CATEGORIES_QUERY } from "#graphql/finance";
import type { Category } from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { cn } from "#lib/utils";

/**
 * A no-spend habit's categories: only spending in the chosen ones breaks
 * the day, so rent or an auto-logged bill doesn't. None chosen counts all
 * spending.
 */
export function NoSpendCategories({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const { data } = useQuery<{ categories: Category[] }>(CATEGORIES_QUERY);
  const expenses = (data?.categories ?? []).filter((c) => c.kind === "expense");
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{t("habits.noSpend.categories")}</legend>
      <p className="text-xs text-muted-foreground">
        {value.length === 0 ? t("habits.noSpend.allSpending") : t("habits.noSpend.onlyChosen")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {expenses.map((category) => {
          const on = value.includes(category.id);
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(category.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {category.icon && (
                <span aria-hidden className="mr-1">
                  {category.icon}
                </span>
              )}
              {categoryName(category)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
