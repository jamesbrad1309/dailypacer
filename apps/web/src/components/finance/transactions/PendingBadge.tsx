import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "#lib/utils";

/** "Pending": logged but not confirmed as gone through. Icon and word, never colour alone. */
export function PendingBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[0.7rem] font-medium text-amber-800 dark:text-amber-300",
        className,
      )}
    >
      <Clock className="size-3" aria-hidden />
      {t("finance.transactions.pending.badge")}
    </span>
  );
}
