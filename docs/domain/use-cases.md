# Use Cases

What the habit tracker actually needs to do (finance use cases live in
[finance/use-cases.md](../finance/use-cases.md)), driving the data model
([habit-data-model.md](habit-data-model.md)) and the GraphQL schema
([graphql-bff.md](../backend/graphql-bff.md)). **Status**: ✅ built · ⬜ not built
yet, as of this doc's last edit. Re-verify against the code before trusting
a ⬜. Rows are grouped by category and sorted by impact within each group.
The **Cross-module** rows link habits to the finance module; see
[finance/index.md](../finance/index.md) and
[finance/habits-integration.md](../finance/habits-integration.md).

**Impact score** (1–5, how much the product suffers without it): `5` core
loop, unusable without it · `4` high-value, used daily · `3` meaningfully
improves UX · `2` edge case / power-user · `1` speculative.

## At a glance

| Area | Built | Open | Top open item (impact) |
| ---- | :---: | :--: | ---------------------- |
| Habit management | 10 | 0 | — |
| Daily tracking | 5 | 0 | — |
| Dashboard & gamification | 4 | 0 | — |
| Calendar | 3 | 0 | — |
| History & review | 3 | 0 | — |
| Motivation & rewards | 5 | 0 | — |
| Routines & structure | 4 | 0 | — |
| Insights | 4 | 0 | — |
| Journaling & mood | 13 | 0 | — |
| Cross-module (habits × finance) | 2 | 3 | Savings-goal contributions count as check-ins (3) |
| **To-do lists** | 13 | 0 | — |
| **Finance** (separate doc) | 60 | 0 | Habits integration in progress, see [finance/use-cases.md](../finance/use-cases.md) |

## Use cases

| Category | Status | Use case | Impact | Notes |
| -------- | :----: | -------- | :----: | ----- |
| **Habit management** | ✅ | **Create a custom habit** (name, icon/color, unit, target, schedule) | 5 | `Mutation.createHabit` via `CreateHabitDialog`, a modal behind the dashboard's "Add habit" button (name, unit, target, start time, schedule; icon/color have no UI yet) |
|  | ✅ | **Edit a habit's definition** (name/unit/target/schedule/start time) | 4 | `Mutation.updateHabit` + `EditHabitDialog` |
|  | ✅ | **Configure a schedule preset** (daily / weekdays / weekends / custom days / N×week / every N days) | 4 | `ScheduleEditor`; presets are just `weekly` with specific `daysOfWeek`, no extra schema |
|  | ✅ | **Set a start time** for the day-calendar view | 3 | `Habit.startTime` ("HH:mm") |
|  | ✅ | **Archive a habit** (soft-delete, keeps history) | 3 | `Mutation.archiveHabit` |
|  | ✅ | **Pause a habit** (skip it without archiving) | 3 | `Mutation.pauseHabit`/`resumeHabit(id, date)`; excluded from `todayHabits` and the day view while paused. Each pause is kept in `habit_pauses` (local start day, resume day), and paused days count as not due: they neither break a streak nor show as missed |
|  | ✅ | **Unarchive / view archived habits** | 2 | Collapsible "Archived habits" list under the dashboard (`archivedHabits`, fetched only when opened), Restore calls `unarchiveHabit` |
|  | ✅ | **Describe a habit**: a short "why / how" shown under its name | 3 | `Habit.description` (≤500 chars), set in the create/edit dialogs, 2 lines on the card |
|  | ✅ | **Tag habits and filter the dashboard by tag** ("health", "morning") | 3 | `Habit.tags` (lowercased, de-duplicated, ≤20); chips above the habit list, and a card's `#tag` filters to it. Filter is not kept in the URL |
|  | ✅ | **Attach arbitrary custom fields to a habit** | 1 | Labelled fields ("Coach: Sam") in the create/edit dialogs, stored in `Habit.metadata.fields` in order, shown on the habit's page |
| **Daily tracking** | ✅ | **See which habits are due today** | 5 | `Query.todayHabits`; day view applies the same `isDueOn` filter client-side |
|  | ✅ | **Check a habit off for today** | 5 | `Mutation.upsertHabitEntry` (`completed: true`) |
|  | ✅ | **Log a quantitative value for today** | 4 | `Mutation.upsertHabitEntry` (`value: 5`) |
|  | ✅ | **Re-check/correct today's entry without duplicating** | 3 | Upsert on `(habitId, date)` by design |
|  | ✅ | **Add a note to today's entry** | 2 | Note field on the dashboard card, saved on blur via `upsertHabitEntry` (value and completion kept; `""` clears). Not in the day view |
| **Dashboard & gamification** | ✅ | **See aggregate level/XP/streak stats across all habits** | 4 | `Query.dashboardStats`, `StatTiles` + the sidebar's level card |
|  | ✅ | **See per-habit streak, points, and level** | 4 | `Habit.currentStreak` as a 🔥 counter in each card's corner (always shown, grey at 0; hover for best), `points`/`level` as a badge |
|  | ✅ | **See a GitHub-style contribution heatmap per habit** | 3 | `Habit.heatmap`, `HeatmapGrid` (120-day window) |
|  | ✅ | **See longest streak / total completions per habit** | 2 | "Best 12d · 48 check-ins in 120 days" under the card's heatmap |
| **Calendar** | ✅ | **Day view: today's due habits on a time-of-day timeline** | 4 | `DayCalendar`, positions habits by `startTime`; untimed habits in a checkable "Anytime today" list beside it |
|  | ✅ | **Check a habit off directly from the day view** | 4 | Same `upsertHabitEntry` mutation as the dashboard card |
|  | ✅ | **Week or month calendar view** | 2 | `/habits/calendar`: a week (a row per habit, Monday to Sunday) or a month (each day's done / due, the chosen day's habits below). Past days and today can be ticked from it. `Query.habitCalendar`, per-day statuses from `day-status.util.ts` |
| **History & review** | ✅ | **Compare all habits over the last 30 days**: one row per habit, a green box per day done, plus a done/30 count | 3 | `/habits/history` (`HabitHistory`); reads the last 30 days of each habit's `Habit.heatmap`, no query of its own. The percentage counts all 30 days, not only scheduled ones |
|  | ✅ | **View a single habit's full entry history** (list, not just heatmap) | 2 | Records table on the habit detail page: date, status (done / partly done / not done), value against target, note; filter All / Done / Not done / **Missed (n)**, 25 rows a page, newest first, **paged on the server** (`Query.habitRecords`, `GET /habits/:id/records`): the browser holds one page. Misses are due days with no entry, or for "times a week" habits each finished week under its target, at most a year back, skipping paused days and weeks (`habit-records.util.ts`); today and this week aren't counted until they're over. Beside the 120-day heatmap, a **this week vs last week** line chart of running check-in counts (`lib/week-comparison.ts`) |
|  | ✅ | **Habit detail page** | 1 | `/habits/$habitId` (`HabitDetail`), opened from a card's name or a History row: description, schedule, tags, streak stats, heatmap, and the records table. One `HabitDetail` query (`habit` + `habitEntries`) |
| **Motivation & rewards** | ✅ | **Streak freeze**: spend earned points to protect a streak on a missed day | 3 | On a habit's page: a missed (or slipped) day from the last 7 can be frozen for 50 points (`StreakFreeze`); it then counts as not due, like a paused day, everywhere (streaks, misses, insights). Undo refunds it |
|  | ✅ | **Achievements / badges** ("First 7-day streak", "100 check-ins", "Perfect week") | 3 | Nine badges on `/habits/rewards`, derived from history at query time (`achievements.util.ts`), with the day each was reached and progress towards the rest |
|  | ✅ | **Milestone celebration** when a streak reaches 7 / 30 / 100 days | 2 | A dialog the moment your own check-in takes a streak to 7, 30 or 100 days (`lib/celebrate.ts`, `useStreakCelebration`); the flame only bounces without reduced motion |
|  | ✅ | **Weekly challenge**: a temporary target, e.g. "meditate 5× this week for 2× XP" | 2 | `HabitChallenge`: N check-ins between two days (this week, 7 or 14 days) for 1.5–3× points; met, its check-ins earn the extra (`challenge.util.ts`). Started from a habit's page, listed on Rewards |
|  | ✅ | **Reward shop**: trade points for self-defined rewards ("takeaway night = 500 pts") | 2 | `Reward` + a `PointsSpend` ledger: points earned from every check-in ever (10 each, plus challenge bonuses) minus spends; spending never lowers the level. Redeem with undo; history on `/habits/rewards` |
| **Routines & structure** | ✅ | **Habit stacking / routines**: group habits into an ordered "Morning routine" and check them off in sequence | 3 | `Routine` + ordered `RoutineHabit` (a habit is in one routine at most). The day view shows a routine as one block at its time (or under Anytime), its habits in order with the next one marked |
|  | ✅ | **Negative habits** ("no sugar", "no doomscrolling"): success is the *absence* of an event | 3 | `Habit.polarity` AVOID: a due day is done unless a slip is logged (`polarity.util.ts` derives the check-ins, so streaks, points, heatmaps and insights work unchanged). An "I slipped" toggle replaces the tick; slips show in records and heatmaps |
|  | ✅ | **Habit templates**: start from a preset such as "Drink water" or "Read" | 2 | Ten presets at the top of the Add habit modal (`lib/habit-templates.ts`), filling name, description, tags, unit, target, start time and schedule in the UI language; nothing about a template is stored except the finance link of "No-spend day" and "Log today's spending" (`metadata.source`) |
|  | ✅ | **Time-boxed habits / programs**: "30-day push-up challenge" that ends on its own | 2 | `Habit.endDate` (with 7 / 30 / 90-day shortcuts): days after it aren't due, the card counts the days left, and the habit archives itself once it has passed |
| **Insights** | ✅ | **Best / worst weekday per habit** ("you skip gym on Fridays") | 3 | Habit detail page, "By weekday": completion rate per weekday over the last 12 weeks (`Query.habitInsights`, `habit-insights.util.ts`), counting due, unpaused days since tracking began; best and worst are named only once each weekday has 3+ due days and they differ. "Times a week" habits compare where check-ins fall |
|  | ✅ | **Completion-rate trend** (this month vs last month) | 3 | Same query: this month so far vs the whole of last month, as done / due days (today counts only once done); "times a week" habits measure against the weekly target. The difference in points shows once this month has 5+ counted days |
|  | ✅ | **Weekly review screen**: a summary each Sunday with wins, misses, and streaks at risk | 3 | `/habits/review`: done vs due against the week before, habits done every time, days missed, streaks at risk today, the best day, and correlations. Opens on last week on Sunday/Monday, with a dashboard banner those days. `Query.weeklyReview` |
|  | ✅ | **Habit correlations** ("on days you exercise you sleep 40 min more") | 2 | `correlations.util.ts` over 90 days: how often (or, with a unit, how much) a habit goes on days another is done vs not, kept only with 5+ days each side and a big enough gap. On the habit page and the weekly review |
| **Journaling & mood** | ✅ | **Log what you did** (an ACTION, with optional duration) | 4 | One textarea: bulleted `/action` lines, parsed by `apps/web/src/lib/journal-syntax.ts`; saved atomically by `Mutation.createJournalEntries` |
|  | ✅ | **Log how you felt** (a FEELING: emotion word + 1–5 intensity, optional "why") | 4 | `/feeling anxious 4/5 why…`; the slash menu autocompletes emotions from `apps/web/src/lib/emotions.ts` |
|  | ✅ | **Log what happened** (an EVENT, tagged good / neutral / rough) | 4 | `/event … (+)` / `(=)` / `(-)` for tone |
|  | ✅ | **Write the journal in Vietnamese** (`/làm`, `/cảm lo âu 4/5`, `/sựkiện`) | 3 | Emotions stored by English key, shown in the UI language; see [i18n.md](../frontend/i18n.md) |
|  | ✅ | **Link a feeling or action to the event behind it** ("stressed ← deadline moved") | 3 | Indent an item under an `/event` in the same list (`triggerIndex`), or press ♥ on a saved event; stored as `JournalEntry.triggerId` (`SET NULL` on delete) |
|  | ✅ | **Browse past days** with a week strip showing each day's dominant emotion | 3 | `Query.journalDays(from, to)`; ← / → and `t` shortcuts |
|  | ✅ | **Journal calendar**: a month of days, each with its dominant emotion and kinds written, and the days you skipped marked as missed | 3 | `/journal/calendar?month=YYYY-MM` (`JournalCalendar`), one `journalDays` call per month grid. Days before `Query.journalFirstDate` are never "missed", nor is today; any day opens that day's journal |
|  | ✅ | **Daily mood score**: grade each day from −1 (unpleasant) to +1 (pleasant) from the feelings logged, in any language | 3 | `apps/web/src/lib/mood.ts`: each FEELING counts +1 / 0 / −1 by its emotion's valence, weighted by intensity (3 if unset); no feelings = no score. Tints the journal calendar (teal ↔ orange, colourblind-checked) with a monthly average and a "Daily mood" bar chart. 57 emotions plus English/Vietnamese aliases; unknown words are left out, or scored by the optional local NRC lexicon (`pnpm lexicon:fetch`, see [journal.md](journal.md)). Free text isn't read; that would need an AI pass |
|  | ✅ | **#tags and filters** by kind or tag within a day | 2 | `tags` parsed from `text` by the API |
|  | ✅ | **Which events drive which feelings** (e.g. "#work events are followed by stress 70% of the time") | 3 | `/journal/insights`: feelings linked to an event, grouped by the event's #tags over 180 days: the most common emotion and the pleasant / unpleasant share (`triggerPatterns` in `lib/habit-mood.ts`, `Query.journalRange`) |
|  | ✅ | **Search the whole journal** by text or tag across all days | 2 | `/journal/search`: text or emotion, a #tag and a kind across every day, newest first, grouped by day, matches highlighted. `Query.journalSearch` |
|  | ✅ | **Daily mood as a streakable habit** | 2 | `/journal/insights`: a check-in streak (days in a row with a feeling; today pending until logged), the best run, and a 120-day heatmap tinted by mood (`Query.journalFeelings`) |
|  | ✅ | **Mood overlay on heatmaps**: tint a habit's heatmap by that day's mood | 1 | "Mood" toggle on a habit's 120-day heatmap: each day tinted by that day's mood, with a dot where the habit was done |
| **Cross-module (habits × finance)** | ✅ | **"No-spend day" habit auto-checked from transactions** | 3 | "No-spend day" template: an avoid habit whose slips are that day's spending transactions, written by `FinanceHabitsService`. Read-only status on the card and day view; see [habits-integration.md §1](../finance/habits-integration.md#1-no-spend-day-habit-auto-checked) |
|  | ⬜ | **Savings-goal contributions count as check-ins** ("save £10/day") | 3 | `SavingsGoal.habitId`, see [habits-integration.md §2](../finance/habits-integration.md#2-savings-goal-as-a-habit) |
|  | ✅ | **"Log today's spending" habit**: an evening habit that opens quick log and counts as done once anything is logged that day | 3 | "Log today's spending" template (21:00). Its button opens quick log in catch-up mode; ticked by a quick/form transaction or a reconcile. See [habits-integration.md §5](../finance/habits-integration.md#5-log-todays-spending-habit) |
|  | ⬜ | **Cost of a habit**: link a habit to a spending category ("coffee", "gym") and show spend next to the streak | 2 | `Habit.linkedSpendMinor(month)`, see [habits-integration.md §3](../finance/habits-integration.md#3-cost-of-a-habit) |
|  | ⬜ | **Unified "LifeOS level"**: XP from both habits and financial discipline (staying under budget) | 2 | Finance XP added in `gamification.util.ts`, see [habits-integration.md §4](../finance/habits-integration.md#4-unified-lifeos-xp) |

## To-do lists

One-off tasks next to habits: `apps/api/src/todos/`, `apps/web/src/components/todos/`,
pages under `/tasks`. Design notes: [todos.md](todos.md). Every task belongs to a list (the built-in **Inbox**,
prefix `TASK`, catches tasks added without one) and has a key
`<list prefix>-<number>`.

| Status | Use case | Impact | Notes |
| :----: | -------- | :----: | ----- |
| ✅ | **Today's to-do list**: add tasks for today, tick them off, reorder them | 5 | `/tasks`: quick add with a list picker (Inbox by default), tick off, progress bar. Today is a view of tasks planned for today from every list (`Query.todayTasks`), not a list. Reorder by dragging a task's handle, or Space and the arrow keys on it (`Task.dayPosition`); done tasks sit below |
| ✅ | **Undone tasks from previous days**: shown in "Earlier, not done", with one action to move to today or unplan | 4 | Tasks planned before today and still open, with "planned N days ago"; Move to today / Unplan per task, and Move all to today. Nothing moves on its own |
| ✅ | **Custom lists with a key prefix**: "Grocery list" / `GRO` → `GRO-1`, `GRO-2`… | 4 | `/tasks/lists`, New list modal validated with zod (`todoListSchema`), including that the prefix isn't used by another list. The prefix is suggested from the name as you type (accents folded: "Đi chợ" → `DIC`, then `DIC2`… if taken) and can be overridden; 2–6 characters, a letter first, unique |
| ✅ | **Rename a list's prefix** without touching task numbers: `GRO-12` becomes `FOOD-12` | 3 | The key is built from the list's current prefix when read, never stored, so a rename is one update. `TodoList.nextNumber` only goes up, so a number is never reused, even after a delete |
| ✅ | **Move a task to another list** | 3 | Decided: it **takes the next number in the new list** (`GRO-4` → `TASK-3`), in one transaction with that list's counter. The task dialog warns before saving |
| ✅ | **Plan a task from any list for a day** | 4 | Decided: yes. `Task.plannedFor` works for every list; Today and Earlier show tasks from all lists with their list name |
| ✅ | **Kanban board** for a list: drag between and within its columns | 4 | `/tasks/lists/$listId`, dnd-kit: mouse, touch, or Space + arrow keys. A drop updates only that task (column, so status, + a position between its neighbours). Done columns show the 50 most recently completed plus the total, so an old list doesn't load its history |
| ✅ | **A task can depend on other tasks**, in the same list or another | 4 | `TaskDependency`; a task is blocked (lock badge) while anything it waits for is open. Loops at any depth and self-links are refused with the reason; completing a blocked task is allowed with a warning |
| ✅ | **Pick a dependency by searching**, not by remembering keys | 3 | Autocomplete over every list by title, key or number (`Query.searchTasks`); only valid choices are offered (not itself, not current dependencies, nothing that would close a loop) |
| ✅ | **Confirm before deleting** a task or list | 3 | Inline prompt in the dialog naming what goes and what it affects (tasks that stop being blocked, a list's task count); focus starts on Cancel |
| ✅ | **Find a task by its key**: typing `GRO-12` opens it | 2 | "Go to a task by key" on the Lists page (`Query.taskByKey`), using each list's current prefix |
| ✅ | **Custom kanban columns** per list (e.g. "Waiting on someone") | 2 | `TodoColumn(listId, name, status, position)`: each column counts as a status, so done, Today and "blocked" work whatever columns are called. Edit columns: add (10 at most), rename, move ←/→, change what it counts as, delete (its tasks move to a column you pick). Every list keeps one column per status. See [todos.md](todos.md#columns) |
| ✅ | **Due dates and reminders** separate from the planned day | 2 | `Task.dueOn` next to `plannedFor` ("due Friday, doing it Thursday"). Due badges (overdue, today, soon) on every task, and a **Due soon** section on Today for open tasks due within 3 days that aren't planned. Reminders are in-app only: email and push wait for [email-and-notifications.md](../backend/email-and-notifications.md) |

## Explicitly out of scope for v1

- Multi-user auth/accounts — every habit is implicitly single-user for now
  (no `User` entity, no login).
- Reminders/notifications.
- A UI for defining typed custom fields (the EAV model in the data-model
  doc) — `metadata` JSON covers the same need with less machinery.
