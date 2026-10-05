import { Flame } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { celebrate, getCelebration, subscribeCelebration } from "#lib/celebrate";

/**
 * The streak-milestone celebration (lib/celebrate.ts): a dialog with the
 * habit and the number of days. The flame only bounces when the user hasn't
 * asked for reduced motion.
 */
export function Celebration() {
  const { t } = useTranslation();
  const current = useSyncExternalStore(subscribeCelebration, getCelebration, getCelebration);
  return (
    <Dialog open={current !== null} onOpenChange={(open) => !open && celebrate(null)}>
      {current && (
        <DialogContent className="max-w-sm text-center sm:max-w-sm">
          <DialogHeader className="items-center text-center sm:text-center">
            <div
              aria-hidden
              className="mx-auto flex size-20 items-center justify-center rounded-full bg-amber-500/15 motion-safe:animate-bounce"
            >
              <Flame className="size-10 text-amber-500" />
            </div>
            <DialogTitle className="text-2xl">
              {t("habits.celebrate.title", { count: current.days })}
            </DialogTitle>
            <DialogDescription>
              {t(
                `habits.celebrate.body${current.days >= 100 ? "100" : current.days >= 30 ? "30" : "7"}`,
                {
                  name: current.habitName,
                  count: current.days,
                },
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button autoFocus onClick={() => celebrate(null)}>
              {t("habits.celebrate.keepGoing")}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
