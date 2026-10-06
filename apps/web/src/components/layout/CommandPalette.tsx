import { useMutation, useQuery } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import {
  Ban,
  CheckCircle2,
  Circle,
  Keyboard,
  Languages,
  ListPlus,
  Moon,
  NotebookPen,
  Plus,
  Receipt,
  ReceiptText,
  Search,
  Sparkles,
  Sun,
  Wallet,
} from "lucide-react";
import { useDeferredValue, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "#components/ui/command";
import {
  DASHBOARD_STATS_QUERY,
  HABITS_QUERY,
  HABIT_PROGRESS_REFETCH,
  UPSERT_HABIT_ENTRY_MUTATION,
} from "#graphql/habits";
import { CREATE_TASK_MUTATION, SEARCH_TASKS_QUERY, TODO_REFETCH } from "#graphql/todos";
import type { HabitsData, Task } from "#graphql/types";
import { openQuickLog } from "#hooks/useQuickLog";
import { toggleTheme, useTheme } from "#hooks/useTheme";
import { LANGUAGES, type Language, currentLanguage, setLanguage } from "#i18n/i18n";
import { getOverlay, requestAction, setOverlay, subscribeOverlay } from "#lib/command-palette";
import { todayIsoDate } from "#lib/dates";
import { isDoneToday } from "#lib/habit-today";
import { NAV_GROUPS } from "#lib/navigation";
import { isDueOn } from "#lib/schedule";
import { displayKeys, goToKeysFor, shortcutById } from "#lib/shortcuts";
import { toast } from "#lib/toast";

/**
 * The command palette (⌘⇧P / Ctrl+Shift+P, or F1): type to filter, ↑/↓ to
 * move, ↵ to run. Actions, today's habits to tick, every page, every habit,
 * and, as you type, matching tasks from every list plus "search the
 * journal / transactions for…". Each item shows its own shortcut, so the
 * palette teaches the keys.
 */
export function CommandPalette() {
  const { t } = useTranslation();
  const open = useSyncExternalStore(subscribeOverlay, getOverlay, getOverlay) === "palette";
  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => setOverlay(next ? "palette" : null)}
      title={t("commands.title")}
      description={t("commands.description")}
    >
      {/* Mounted only while open, so it starts empty every time. */}
      {open && <Palette />}
    </CommandDialog>
  );
}

/**
 * Every typed word must appear in the item's text or keywords; an item where
 * a word starts a word ranks above one where it's buried mid-word. cmdk's
 * default is looser (letters in order anywhere), so "bud" ranked "Show
 * keyboard shortcuts" above "Budgets".
 */
function paletteFilter(value: string, search: string, keywords: string[] = []): number {
  const text = `${value} ${keywords.join(" ")}`.toLowerCase();
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every((word) => text.includes(word))) return 0;
  const starts = text.split(/[\s·/-]+/);
  return words.every((word) => starts.some((start) => start.startsWith(word))) ? 1 : 0.5;
}

function Palette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [query, setQuery] = useState("");
  const typed = useDeferredValue(query.trim());
  const { data: habitsData } = useQuery<HabitsData>(HABITS_QUERY);
  const { data: tasksData } = useQuery<{ searchTasks: Task[] }>(SEARCH_TASKS_QUERY, {
    variables: { query: typed },
    skip: typed.length < 2,
  });
  const [upsertEntry] = useMutation(UPSERT_HABIT_ENTRY_MUTATION, {
    refetchQueries: [
      { query: HABITS_QUERY },
      { query: DASHBOARD_STATS_QUERY },
      ...HABIT_PROGRESS_REFETCH,
    ],
  });
  const [createTask] = useMutation(CREATE_TASK_MUTATION, { refetchQueries: TODO_REFETCH });

  const close = () => setOverlay(null);
  const run = (action: () => void) => () => {
    close();
    action();
  };
  const keysFor = (id: string) => {
    const keys = shortcutById(id)?.keys[0];
    return keys ? displayKeys(keys) : undefined;
  };

  const habits = habitsData?.habits ?? [];
  // No-spend and savings habits are ticked by money moving, so there's nothing to do with them here.
  const dueToday = habits.filter(
    (h) =>
      !h.paused &&
      h.financeSource !== "NO_SPEND" &&
      h.financeSource !== "SAVINGS_GOAL" &&
      isDueOn(h.schedule, new Date()),
  );
  const otherLanguage = (Object.keys(LANGUAGES) as Language[]).find(
    (l) => l !== currentLanguage(),
  ) as Language;

  return (
    <Command loop filter={paletteFilter}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("commands.placeholder")}
      />
      <CommandList>
        <CommandEmpty>{t("commands.empty")}</CommandEmpty>

        {/* Ungrouped, so cmdk lists it last: the catch-all when nothing else fits. (Inside a group it would hide whenever the group's other items didn't match.) */}
        {typed && (
          <CommandItem
            value={`add task ${typed}`}
            forceMount
            className="mx-1 mt-1"
            onSelect={run(async () => {
              await createTask({
                variables: { input: { title: typed, plannedFor: todayIsoDate() } },
              });
              toast(t("commands.taskAdded", { title: typed }));
            })}
          >
            <ListPlus />
            {t("commands.addTask", { title: typed })}
          </CommandItem>
        )}

        <CommandGroup heading={t("commands.groups.actions")}>
          <CommandItem
            value={t("commands.logExpense")}
            keywords={["spend", "money", "chi tiêu"]}
            onSelect={run(() => openQuickLog())}
          >
            <Wallet />
            {t("commands.logExpense")}
            <CommandShortcut keys={keysFor("quickLog") ?? []} />
          </CommandItem>
          <CommandItem
            value={t("commands.newHabit")}
            onSelect={run(() => {
              requestAction("newHabit");
              navigate({ to: "/habits" });
            })}
          >
            <Plus />
            {t("commands.newHabit")}
          </CommandItem>
          <CommandItem
            value={t("commands.writeJournal")}
            onSelect={run(() => navigate({ to: "/journal" }))}
          >
            <NotebookPen />
            {t("commands.writeJournal")}
          </CommandItem>
          <CommandItem
            value={t("commands.toggleTheme")}
            keywords={["dark", "light", "theme"]}
            onSelect={run(toggleTheme)}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
            {theme === "dark" ? t("commands.lightMode") : t("commands.darkMode")}
          </CommandItem>
          <CommandItem
            value={`language ${LANGUAGES[otherLanguage].label}`}
            onSelect={run(() => setLanguage(otherLanguage))}
          >
            <Languages />
            {t("commands.switchLanguage", { language: LANGUAGES[otherLanguage].label })}
          </CommandItem>
          <CommandItem
            value={t("commands.showShortcuts")}
            keywords={["keyboard", "keys", "help"]}
            onSelect={() => setOverlay("help")}
          >
            <Keyboard />
            {t("commands.showShortcuts")}
            <CommandShortcut keys={keysFor("help") ?? []} />
          </CommandItem>
        </CommandGroup>

        {dueToday.length > 0 && (
          <CommandGroup heading={t("commands.groups.today")}>
            {dueToday.map((habit) => {
              if (habit.financeSource === "LOGGED_TODAY") {
                const label = t("habits.card.logSpendingFor", { name: habit.name });
                return (
                  <CommandItem
                    key={habit.id}
                    value={`today ${label}`}
                    keywords={habit.tags}
                    onSelect={run(() => openQuickLog({ catchUp: true }))}
                  >
                    <ReceiptText />
                    {label}
                  </CommandItem>
                );
              }
              const done = isDoneToday(habit);
              const avoid = habit.polarity === "AVOID";
              const label = avoid
                ? done
                  ? t("commands.logSlip", { name: habit.name })
                  : t("commands.undoSlip", { name: habit.name })
                : done
                  ? t("commands.uncheck", { name: habit.name })
                  : t("commands.check", { name: habit.name });
              return (
                <CommandItem
                  key={habit.id}
                  value={`today ${label}`}
                  keywords={habit.tags}
                  onSelect={run(() =>
                    upsertEntry({
                      variables: {
                        input: avoid
                          ? {
                              habitId: habit.id,
                              date: todayIsoDate(),
                              completed: false,
                              value: done ? 1 : 0,
                            }
                          : { habitId: habit.id, date: todayIsoDate(), completed: !done },
                      },
                    }),
                  )}
                >
                  {avoid ? <Ban /> : done ? <CheckCircle2 /> : <Circle />}
                  {label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {tasksData && tasksData.searchTasks.length > 0 && typed.length >= 2 && (
          <CommandGroup heading={t("commands.groups.tasks")} forceMount>
            {tasksData.searchTasks.map((task) => (
              <CommandItem
                key={task.id}
                value={`task ${task.key} ${task.title}`}
                forceMount
                onSelect={run(() =>
                  navigate({ to: "/tasks/lists/$listId", params: { listId: task.listId } }),
                )}
              >
                <span className="rounded bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
                  {task.key}
                </span>
                <span className="truncate">{task.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {t(`todos.status.${task.status}`)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {typed.length >= 2 && (
          <CommandGroup heading={t("commands.groups.search")} forceMount>
            <CommandItem
              value={`search journal ${typed}`}
              forceMount
              onSelect={run(() => navigate({ to: "/journal/search", search: { q: typed } }))}
            >
              <Search />
              {t("commands.searchJournal", { query: typed })}
            </CommandItem>
            <CommandItem
              value={`search transactions ${typed}`}
              forceMount
              onSelect={run(() =>
                navigate({ to: "/finance/transactions", search: { view: "all", q: typed } }),
              )}
            >
              <Receipt />
              {t("commands.searchTransactions", { query: typed })}
            </CommandItem>
          </CommandGroup>
        )}

        {NAV_GROUPS.map((group) => (
          <CommandGroup
            key={group.label}
            heading={t("commands.goToGroup", { group: t(`shell.nav.groups.${group.label}`) })}
          >
            {group.items.map((item) => {
              const Icon = item.icon;
              const name = t(`shell.nav.${item.label}`);
              const keys = goToKeysFor(item.to);
              return (
                <CommandItem
                  key={item.to}
                  value={`go ${t(`shell.nav.groups.${group.label}`)} ${name}`}
                  onSelect={run(() => navigate({ to: item.to }))}
                >
                  <Icon />
                  {name}
                  {keys && <CommandShortcut keys={displayKeys(keys)} />}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}

        {habits.length > 0 && (
          <CommandGroup heading={t("commands.groups.habits")}>
            {habits.map((habit) => (
              <CommandItem
                key={habit.id}
                value={`habit ${habit.name}`}
                keywords={habit.tags}
                onSelect={run(() =>
                  navigate({ to: "/habits/$habitId", params: { habitId: habit.id } }),
                )}
              >
                <Sparkles />
                {habit.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CommandShortcut keys={["↑", "↓"]} className="ml-0" /> {t("commands.footer.move")}
        </span>
        <span className="flex items-center gap-1.5">
          <CommandShortcut keys={["↵"]} className="ml-0" /> {t("commands.footer.run")}
        </span>
        <span className="flex items-center gap-1.5">
          <CommandShortcut keys={["Esc"]} className="ml-0" /> {t("commands.footer.close")}
        </span>
      </div>
    </Command>
  );
}
