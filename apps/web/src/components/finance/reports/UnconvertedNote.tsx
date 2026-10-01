import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Spending in currencies with no exchange rate yet is left out of the totals: say so. */
export function UnconvertedNote({ codes }: { codes: string[] }) {
  const { t } = useTranslation();
  if (codes.length === 0) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
      {t("finance.currencies.notConverted", { codes: codes.join(", ") })}
    </p>
  );
}
