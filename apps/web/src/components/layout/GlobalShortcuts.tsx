import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { type KeybindingsMap, defaultKeybindingsHandlerIgnore, tinykeys } from "tinykeys";
import { openQuickLog } from "#hooks/useQuickLog";
import { getOverlay, setOverlay, togglePalette } from "#lib/command-palette";
import { SHORTCUTS, shortcutById } from "#lib/shortcuts";

/** Another dialog (an edit form, quick log) owns the keyboard while it's open. */
const dialogOpen = () => document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;

/**
 * The app-wide key bindings from lib/shortcuts.ts. The palette opens from
 * anywhere, even a text field; every other key is ignored while typing or
 * while a dialog is open. Bindings run in the capture phase and mark the
 * event handled, so a page's own keys (the journal's `h`) don't also fire on
 * the second key of "g h".
 */
export function GlobalShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const always: KeybindingsMap = {};
    for (const keys of shortcutById("openPalette")?.keys ?? []) {
      always[keys] = (event) => {
        event.preventDefault();
        togglePalette();
      };
    }

    const handled = (run: () => void) => (event: KeyboardEvent) => {
      event.preventDefault();
      run();
    };
    const plain: KeybindingsMap = {};
    for (const keys of shortcutById("help")?.keys ?? []) {
      plain[keys] = handled(() => setOverlay(getOverlay() === "help" ? null : "help"));
    }
    for (const keys of shortcutById("quickLog")?.keys ?? []) {
      plain[keys] = handled(() => openQuickLog());
    }
    for (const shortcut of SHORTCUTS.filter((s) => s.group === "goTo" && s.to)) {
      for (const keys of shortcut.keys) {
        plain[keys] = handled(() => navigate({ to: shortcut.to as string }));
      }
    }

    const offAlways = tinykeys(window, always, { capture: true, ignore: (e) => e.repeat });
    const offPlain = tinykeys(window, plain, {
      capture: true,
      ignore: (e) => defaultKeybindingsHandlerIgnore(e) || dialogOpen(),
    });
    return () => {
      offAlways();
      offPlain();
    };
  }, [navigate]);

  return null;
}
