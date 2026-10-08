import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { CommandShortcut } from "#components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { getOverlay, setOverlay, subscribeOverlay } from "#lib/command-palette";
import { displayKeys, SHORTCUTS, type ShortcutGroup } from "#lib/shortcuts";

const ORDER: ShortcutGroup[] = ["general", "goTo", "journal", "notifications", "palette"];

/** The `?` cheat sheet: every shortcut, from the same table the bindings use. */
export function ShortcutsHelp() {
  const { t } = useTranslation();
  const open = useSyncExternalStore(subscribeOverlay, getOverlay, getOverlay) === "help";
  return (
    <Dialog open={open} onOpenChange={(next) => setOverlay(next ? "help" : null)}>
      {open && (
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("commands.help.title")}</DialogTitle>
            <DialogDescription>{t("commands.help.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {ORDER.map((group) => (
              <section key={group} className="flex flex-col gap-1.5">
                <h3 className="text-xs font-medium text-muted-foreground">
                  {t(`commands.groups.${group}`)}
                </h3>
                <ul className="flex flex-col gap-1">
                  {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                    <li key={s.id} className="flex items-center gap-3 text-sm">
                      <span className="min-w-0 flex-1">
                        {s.group === "goTo"
                          ? t(`shell.nav.${s.label}` as "shell.nav.dashboard")
                          : t(s.label as "commands.shortcuts.help")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {s.keys.map((keys, i) => (
                          <span key={keys} className="flex items-center gap-1.5">
                            {i > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {t("commands.help.or")}
                              </span>
                            )}
                            <CommandShortcut keys={displayKeys(keys)} className="ml-0" />
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
