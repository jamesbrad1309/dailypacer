import { NAV_GROUPS } from "#lib/navigation";

/**
 * Every keyboard shortcut in one table: the key bindings
 * (components/layout/GlobalShortcuts.tsx), the hints in the command
 * palette and the `?` cheat sheet all read it, so they can't disagree.
 * `keys` is tinykeys syntax: `$mod` is ⌘ on a Mac and Ctrl elsewhere, and a
 * space separates the keys of a sequence ("g h").
 */
export type ShortcutGroup = "general" | "goTo" | "journal" | "palette";

export interface Shortcut {
  id: string;
  group: ShortcutGroup;
  /** One or more alternative bindings. */
  keys: string[];
  /** An i18n key for what it does; or, for go-to, the nav label (`shell.nav.<label>`). */
  label: string;
  /** Go-to shortcuts: where they go. */
  to?: string;
  /** Shown in the cheat sheet only: handled by its page (the journal's own keys). */
  pageOnly?: boolean;
}

export const OPEN_PALETTE = "openPalette";

const GENERAL: Shortcut[] = [
  {
    id: OPEN_PALETTE,
    group: "general",
    keys: ["$mod+Shift+P", "F1"],
    label: "commands.shortcuts.openPalette",
  },
  { id: "help", group: "general", keys: ["Shift+?"], label: "commands.shortcuts.help" },
  { id: "quickLog", group: "general", keys: ["n"], label: "commands.shortcuts.quickLog" },
];

const PALETTE: Shortcut[] = [
  {
    id: "paletteMove",
    group: "palette",
    keys: ["ArrowUp", "ArrowDown"],
    label: "commands.shortcuts.paletteMove",
  },
  { id: "paletteRun", group: "palette", keys: ["Enter"], label: "commands.shortcuts.paletteRun" },
  {
    id: "paletteClose",
    group: "palette",
    keys: ["Escape"],
    label: "commands.shortcuts.paletteClose",
  },
];

const JOURNAL: Shortcut[] = [
  {
    id: "journalDid",
    group: "journal",
    keys: ["d"],
    label: "commands.shortcuts.journalDid",
    pageOnly: true,
  },
  {
    id: "journalFelt",
    group: "journal",
    keys: ["f"],
    label: "commands.shortcuts.journalFelt",
    pageOnly: true,
  },
  {
    id: "journalHappened",
    group: "journal",
    keys: ["h"],
    label: "commands.shortcuts.journalHappened",
    pageOnly: true,
  },
  {
    id: "journalDays",
    group: "journal",
    keys: ["ArrowLeft", "ArrowRight"],
    label: "commands.shortcuts.journalDays",
    pageOnly: true,
  },
  {
    id: "journalToday",
    group: "journal",
    keys: ["t"],
    label: "commands.shortcuts.journalToday",
    pageOnly: true,
  },
];

/** "g h" and friends, from the sidebar's own entries (`go` in lib/navigation.ts). */
const GO_TO: Shortcut[] = NAV_GROUPS.flatMap((group) =>
  group.items.flatMap((item) =>
    item.go
      ? [
          {
            id: `go:${item.to}`,
            group: "goTo" as const,
            keys: [`g ${item.go}`],
            label: item.label,
            to: item.to,
          },
        ]
      : [],
  ),
);

export const SHORTCUTS: Shortcut[] = [...GENERAL, ...GO_TO, ...JOURNAL, ...PALETTE];

export function shortcutById(id: string): Shortcut | undefined {
  return SHORTCUTS.find((s) => s.id === id);
}

/** The go-to binding for a route, for the palette's hints. */
export function goToKeysFor(to: string): string | undefined {
  return GO_TO.find((s) => s.to === to)?.keys[0];
}

const isMac = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

const SYMBOLS: Record<string, [mac: string, other: string]> = {
  $mod: ["⌘", "Ctrl"],
  Shift: ["⇧", "Shift"],
  Alt: ["⌥", "Alt"],
  Control: ["⌃", "Ctrl"],
  Meta: ["⌘", "Win"],
  ArrowUp: ["↑", "↑"],
  ArrowDown: ["↓", "↓"],
  ArrowLeft: ["←", "←"],
  ArrowRight: ["→", "→"],
  Enter: ["↵", "Enter"],
  Escape: ["Esc", "Esc"],
};

/**
 * A binding as the keys to show, one per `<kbd>`: "$mod+Shift+P" → ⌘ ⇧ P on
 * a Mac, Ctrl Shift P elsewhere; "g h" → G H; "Shift+?" → ?.
 */
export function displayKeys(binding: string, mac = isMac()): string[] {
  return binding.split(" ").flatMap((press) => {
    const parts = press.split("+");
    // "?" is typed with Shift; showing both reads oddly.
    if (parts.length === 2 && parts[0] === "Shift" && !/^[a-z0-9]$/i.test(parts[1]))
      return [parts[1]];
    return parts.map((part) => {
      const symbol = SYMBOLS[part];
      if (symbol) return mac ? symbol[0] : symbol[1];
      return part.length === 1 ? part.toUpperCase() : part;
    });
  });
}
