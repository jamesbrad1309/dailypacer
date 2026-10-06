# Habits × Finance Integration

These features only work because both modules live in one app. They're
listed as use cases under "Cross-module" in
[domain/use-cases.md](../domain/use-cases.md).

## How §1, §2 and §5 are built

Both habits are ordinary habits with `metadata.source` set, so they need no
migration. The rules for one day are pure functions in
`apps/api/src/finance/finance-habits.util.ts`.
`FinanceHabitsService.syncDays(days)` works those days out again for
every linked habit and writes the result through
`HabitEntriesService.upsert`. It runs after every transaction write has
committed:

- `TransactionsService` create, update (the old and new day), split and delete, so quick log and confirmed subscription charges are covered too
- subscription auto-log catch-up
- CSV import
- a reconcile, via `markReconciled(date)`

`FinanceModule` imports `HabitEntriesModule`, never the reverse. Sync
errors are logged and swallowed (see Guardrails). Nothing is written for
days before the habit's creation day (less one, for time zones): an older
entry would move its tracking start back and hand out clean no-spend days.

In the API: the GraphQL `Habit.financeSource` field (`NO_SPEND` |
`LOGGED_TODAY`) maps to `metadata.source`, and `CreateHabitInput.financeSource`
and `financeCategoryIds` set it. `createHabit` runs `POST
/finance/habits/:id/recompute` straight away, so a new habit's past days
are already filled in.

In the web app, two templates in the create dialog ("No-spend day" and
"Log today's spending") set it up. `HabitCheck` swaps the tick for a
finance control, and the calendar won't tick these habits by hand. Every
transaction write refetches the habit queries (`TRANSACTIONS_REFETCH`).

## 1. "No-spend day" habit, auto-checked

A habit whose entries are **derived from transactions** instead of logged
by hand.

- `metadata: { source: "finance.noSpend", categoryIds?: [...] }`.
- It's an **avoid** habit, so a day with no entry is a clean day and
  nothing has to be written for quiet days. A day with spending gets a
  slip entry whose `value` is the number of spending transactions. Once
  they're deleted or moved, the value goes back to 0.
- Spending means money out, but not transfers or balance adjustments.
  With `categoryIds`, only spending in those categories counts (a split
  counts if any part does), so rent doesn't break the streak. Picked in
  the create and edit dialogs (`NoSpendCategories`, expense categories);
  changing them in edit re-derives the habit's past days.
- The card and day view show "Nothing spent" or "Spent today", read-only.

The heatmap then shows no-spend days for free.

## 2. Savings goal as a habit

"Save £10 a day towards Japan". Built:

- The goal dialog's "Save a set amount each day" field
  (`dailyHabitMinor`) makes an ordinary daily habit:
  - `unit` is the goal's currency and `targetValue` the amount in major
    units (`10`).
  - Its metadata is `{ source: "finance.savingsGoal", goalId }`.
  - `SavingsGoal.habitId` points at it, and that link is the one the code
    trusts.
  - Clearing the field archives the habit, so its streak history stays.
    Setting it again brings the same habit back.
  - Deleting the goal archives its habit.
  - A savings habit can't be made from the habit dialog; GraphQL refuses
    `financeSource: SAVINGS_GOAL`.
- **A day's value is what was put aside that day**
  (`savedOnDay` / `savedEntry`); the habit is done once that reaches the
  target.
  - For a goal that follows an account, it's the net of that account's
    transactions that day: transfers in, less anything taken out.
  - For an unlinked goal, it's that day's `SavingsContribution` rows. Each
    "add money" (`contribute`) records one with its day; `savedMinor`
    stays the running total.
- **Put aside, from the habit**: `HabitCheck` shows "£4.00 today" or "Put
  aside". It opens `SaveToGoalDialog`, prefilled with the daily amount.
  - An unlinked goal gets a contribution.
  - A linked goal gets a transfer from an account in the same currency,
    the default account first.
  - Either way, the finance write ticks the habit. Nothing is ticked by
    hand.
- Transfers sync their day too (`createTransfer`), since money into a
  goal's account is saving. Linking a goal to another account recomputes
  its habit.

## 3. Cost of a habit

Link a habit to one or more spending categories
(`metadata.financeCategoryIds`). Then show, on the `HabitCard`:

- "Coffee (avoid): 12-day streak · spent £3.40 this month vs £48 last month"
- For positive habits such as "Gym": cost per check-in, meaning the
  membership fee divided by visits this month. It's a good motivator.

This is a read-only `Habit.linkedSpendMinor(month)` field resolved through
the finance `ReportsService`.

## 4. Unified LifeOS XP

Extend `gamification.util.ts` with finance sources, keeping the rule that
XP is derived and never stored:

| Event                                           | XP   |
| ----------------------------------------------- | ---- |
| Habit check-in (existing)                       | 10   |
| Day of current streak (existing)                | 5    |
| Category finished the month under budget        | 25   |
| Savings goal reached                            | 100  |
| Transactions logged or imported that week (consistency) | 10   |

`dashboardStats` gains a `lifeLevel` computed from habit XP plus finance
XP. Keep the per-module numbers visible so it's clear where the XP came
from.

## 5. "Log today's spending" habit

This turns the logging routine itself into a habit, which is the most
direct fix for "I forget to log":

- A habit with `metadata: { source: "finance.loggedToday" }`, `startTime: "21:00"`,
  shown in the day view like any other habit.
- Tapping it in the day view **opens quick log** in evening catch-up mode
  (see [quick-log.md](quick-log.md)) instead of just ticking it.
- It's auto-checked, the same way as the no-spend habit in §1, once at
  least one `quick` or `form` transaction exists for that date. **Reconcile
  also counts**, because updating balances is a valid way to keep finances
  accurate. A reconcile that finds nothing to adjust records no
  transaction, so the entry stores `metadata.reconciled: true` to remember
  it.
- `openQuickLog({ catchUp: true })` starts the sheet in "log several"
  mode without changing the remembered setting.
- The streak then rewards the logging routine, and it uses the existing
  streak, points and heatmap code unchanged.

## Guardrails

- **Never block a finance write on a habits side effect.** If the no-spend
  upsert fails, log it and continue. The transaction is the source of
  truth, and the habit entry can be recomputed.
- `recomputeDerivedHabitEntries(habitId)` (GraphQL; `POST
  /finance/habits/:habitId/recompute` in the API) rebuilds a linked habit's
  entries from transactions after bulk imports or bug fixes.
