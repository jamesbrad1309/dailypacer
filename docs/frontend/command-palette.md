# Command Palette and Keyboard Shortcuts

Press **⌘⇧P** (Ctrl+Shift+P on Windows and Linux), like VS Code, to open
the palette from anywhere, even while typing in a field. **F1** opens it
too, because Firefox keeps Ctrl+Shift+P for a private window. Mouse and
touch users get the "Search or run a command…" button in the app bar.

Libraries:

- [cmdk](https://cmdk.paco.me): the filterable list, arrow-key movement
  and ARIA combobox. Wrapped as shadcn's `components/ui/command.tsx`.
- [tinykeys](https://github.com/jamiebuilds/tinykeys): key bindings,
  including `$mod` (⌘ on Mac, Ctrl elsewhere) and sequences like `g h`.

## What the palette holds

| Group | Items |
|---|---|
| Actions | Log an expense · New habit · Write in the journal · Toggle theme · Switch language · Show keyboard shortcuts |
| Today's habits | Check or uncheck each habit due today. An avoid habit logs or undoes today's slip. "Log today's spending" opens quick log in catch-up mode instead, and a no-spend habit isn't listed (both are ticked from transactions) |
| Tasks | Once 2+ characters are typed: matching tasks from every list (key, title, status). Opens the task's list |
| Search | Once 2+ characters are typed: "Search the journal for…" and "Search transactions for…" |
| Go to · *section* | Every page in the sidebar, with its `g` shortcut |
| Habits | Every habit, opening its detail page |
| *(last)* | "Add task "…" to today": puts what you typed into the Inbox, planned for today |

Filtering (`paletteFilter` in `CommandPalette.tsx`) needs every typed word
to appear in an item's text or keywords. Items where a word starts a word
rank first. cmdk's default fuzzy match was too loose: "bud" ranked "Show
keyboard shortcuts" above "Budgets".

"New habit" navigates to `/habits` and calls `requestAction("newHabit")`.
`CreateHabitDialog` listens with `onAction` (`lib/command-palette.ts`), so it
opens whether the page was already showing or has just mounted.

## Shortcuts

One registry, `lib/shortcuts.ts`, feeds the bindings, the `?` cheat sheet
(`ShortcutsHelp.tsx`) and the hints shown on palette items, so they can't
disagree.

| Keys | Does |
|---|---|
| ⌘⇧P / Ctrl+Shift+P, F1 | Open or close the palette |
| `?` | Keyboard shortcuts cheat sheet |
| `n` | Log an expense (quick log) |
| `g` then a letter | Go to a page: `g p` Progress, `g h` Dashboard, `g d` Today's habits, `g c` Calendar, `g r` Weekly review, `g w` Rewards, `g t` To-do Today, `g l` Lists, `g j` Journal, `g m` Mood & patterns, `g a` Accounts, `g x` Transactions, `g s` Spending, `g b` Budgets, `g o` Goals |
| `d` `f` `h`, ← →, `t` | On the journal page only: new did/felt/happened entry, previous/next day, today |

The `g` letters live on each `NavItem` (`go` in `lib/navigation.ts`). A new
page gets its shortcut by adding `go: "x"` there. A test checks that no two
bindings collide.

Rules (`GlobalShortcuts.tsx`):

- The palette keys work everywhere, inputs included.
- Single keys and `g` sequences are ignored while typing in a field, on
  key repeat, and while any dialog is open, so they never steal a letter.
- Bindings listen in the capture phase and call `preventDefault()`. A page's
  own key handler must skip `e.defaultPrevented` events. The journal does
  this, so the `h` of `g h` doesn't also start a "happened" entry.

Which overlay is open (palette, cheat sheet or neither) is a tiny external
store in `lib/command-palette.ts`, like `lib/toast.ts`, so a key binding,
a button or the palette itself can open either one.
