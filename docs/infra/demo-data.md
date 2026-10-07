# Demo data

A dataset you can load into an empty LifeOS whenever you like, and whose
history always ends today: every date in it is stored as an offset from
the import day, so importing it next year still gives yesterday's coffee,
this week's runs and last month's budget.

```sh
pnpm demo:import                      # apps/api/demo/lifeos-demo.json, day 0 = today
pnpm demo:import -- path/to/file.json --today=2027-01-15
pnpm demo:export -- path/to/file.json # the current database, as a fixture
```

Both run on the host against `DATABASE_URL` in `.env` (the Docker
Postgres on port 5433), so the stack's `postgres` service must be up.

## The fixture

`apps/api/src/demo/demo-fixture.ts` defines it. In short:

- **Days** are offsets: `day: -3` is three days before the import day,
  `0` the day itself. Budget `month`s are month offsets (`-1` is last month).
- **Categories** are a seeded one's key (`coffee`) or the name of one of
  your own, listed under `categories`.
- **Accounts** have a `ref` that transactions, transfers and goals use.
  Their balance is as typed in the app, so a card's amount owed is positive.
- **Finance-ticked habits** (no-spend, log today's spending, a goal's daily
  saving habit) carry no entries. The import works them out from the
  transactions. A goal brings its daily habit with it (`dailyHabitMinor`).

`apps/api/demo/lifeos-demo.json` is about 8 weeks of history:

- **Money:** a current account, savings, a credit card, cash and an IOU,
  with salary, rent, bills and everyday spending. Some days have no
  spending, so the no-spend habits have streaks. There's one split
  transaction, card payments, and daily transfers into savings.
- **Budgets and goals:** budgets for two months back, and three savings
  goals.
- **Habits:** thirteen, including one paused and one archived.
- **Journal:** three weeks of entries.
- **To-do lists:** Inbox, Groceries, Home and Work, some tasks done in
  past weeks and some overdue.

## How the import works

`import-demo.ts` refuses a database that already has accounts, habits,
goals, journal entries or tasks: mixing demo and real data can't be undone
cleanly. Start from a fresh one: `docker compose down -v`, then `up`.

It goes through the app's services, not raw inserts, so balances, monthly
totals and splits come out as if typed in. Then it fixes what services
stamp with "now":

- habit and task creation days, and task completion days, are backdated
- every finance-ticked habit is recomputed once its creation day is right

Days follow the local clock of the machine running it (`localToday`).

## What export leaves out

`export-demo.ts` writes only what the import can rebuild. It counts
everything else on stderr:

- balance adjustments
- subscriptions and their charges
- streak freezes, challenges, routines and rewards
- payee rules and quick-log presets
- task dependencies and custom board columns
