import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { openQuickLog, useQuickLogState } from "#hooks/useQuickLog";

/**
 * The floating ➕ on every screen; `n` opens it too (lib/shortcuts.ts):
 * getting to the log has to be as fast as logging.
 */
export function QuickLogButton() {
  const { t } = useTranslation();
  const { open } = useQuickLogState();

  if (open) return null;
  return (
    <button
      type="button"
      onClick={() => openQuickLog()}
      aria-label={t("finance.quickLog.open")}
      title={t("finance.quickLog.openHint")}
      className="fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform outline-none hover:scale-105 focus-visible:ring-4 focus-visible:ring-ring/50 lg:right-8 lg:bottom-8"
    >
      <Plus className="size-6" />
    </button>
  );
}
