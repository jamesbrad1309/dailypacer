# Multi-user Plan

**Status: planned, nothing built.** DailyPacer is single-user today: there's
no `User` table, no sign-in, and every habit, account and task belongs to one
implicit person. This is the plan for turning it into a multi-user app, written
before any code so the order and the open decisions are agreed first. It
unblocks the ⏸ rows in the [admin use cases](use-cases.md) and replaces the
admin's temporary "no sign-in" bypass.

## Goals

- Many people use one deployment, each seeing only their own data.
- Sign-in for the web app and the admin; an `admin` role gates the admin.
- The current data becomes the first user's (the owner), with no data loss.
- Every service stays where it is: the BFF authenticates, the API scopes.

Not goals for this round: sharing data between users (households, shared
budgets), organisations/teams, billing.

## Open decisions

| Decision | Options | Leaning |
| -------- | ------- | ------- |
| How people sign in | Email magic link · passkeys · password · external OIDC (Auth0, Clerk, Keycloak) | Magic link first (fits the planned email setup, [email-and-notifications.md](../backend/email-and-notifications.md)); passkeys later |
| Where the session lives | httpOnly cookie set by the BFF · bearer token in the SPA | Cookie: the SPA never holds a token |
| How the API learns who's calling | Trust an `x-user-id` header from the BFF on the internal network · BFF forwards a signed token the API verifies | Signed token (short-lived, BFF-signed), so a stray request to the API can't pick a user |
| Scoping in the API | Pass `userId` through every service call · request-scoped context (AsyncLocalStorage) plus a Prisma client extension that adds `where: { userId }` | Context + extension, with explicit `userId` in raw SQL |
| Per-user or shared | Exchange rates and service logos | Shared (market data and a cache); everything else per user |

## Phases

### 1. Users and sign-in (no scoping yet)

- `User` (id, email unique, name, role `owner | admin | member`, status
  `active | disabled`, createdAt, lastSeenAt) and `Session`.
- Sign-in and sign-out in the BFF; `Query.me`. The web app and the admin get
  a sign-in page; the admin also checks `role`.
- A migration creates the owner from an env var (`OWNER_EMAIL`).
- Admin: Users list, invite, disable, change role (the ⏸ rows).
- Still one dataset: everyone signed in sees the owner's data, so only the
  owner should be invited until phase 3 lands.

### 2. Ownership columns

Add `userId` (FK to `User`, indexed) to every table a person owns directly,
nullable at first, backfilled to the owner, then `NOT NULL`:

- **Habits:** `Habit`, `Routine`, `Reward`, `PointsSpend`
- **Journal:** `JournalEntry`
- **Money:** `Account`, `Category`, `Transaction` (denormalised from its
  account, for list and report queries), `QuickPreset`, `MonthlyTotal`,
  `Budget`, `Subscription`, `SavingsGoal`, `PayeeRule`, the user's
  currencies (see below)
- **Tasks:** `TodoList`, `Task` (denormalised, for search across lists)
- **Notifications:** `Notification` (after PR #21)

Rows that hang off one of those (`HabitEntry`, `StreakFreeze`, `HabitPause`,
`HabitChallenge`, `RoutineHabit`, `TransactionSplit`, `SubscriptionPrice`,
`SubscriptionCharge`, `TodoColumn`, `TaskDependency`,
`SavingsContribution`) are reached through their parent and don't need
their own column.

Constraints that are global today and must become per user:

| Today | Becomes |
| ----- | ------- |
| `TodoList.prefix` `@unique` | `@@unique([userId, prefix])` (two people can both have `HOME-1`) |
| `Currency.code` `@id` (and its `isMain` flag) | a `UserCurrency` table, `@@id([userId, code])`; `ExchangeRate` stays shared |
| `Transaction.clientId` `@unique` (quick-log idempotency) | `@@unique([userId, clientId])` |
| `Category @@unique([parentId, name])` | add `userId` to it; top-level names are only unique per user |
| `Notification.key` `@unique` | `@@unique([userId, key])` |
| Seeded categories and the Inbox list | created per user at sign-up, not by a migration |

### 3. Scope every read and write

- A request context carries `userId` from the BFF's token; a Prisma client
  extension adds it to every query on an owned model and refuses one without
  it.
- Raw SQL needs it by hand: `transactions.service` (tag counts),
  `reports.service`, `monthly-totals.service`, `subscriptions.service`,
  `life-level.service`.
- Another user's id behaves like a missing row: 404, never 403, so ids
  can't be probed.
- Tests: a two-user fixture, and for each controller a check that user B
  can't read or change user A's rows.

### 4. Per-user settings

Main currency, language and time zone move onto the user. The client
already sends its local day and time (`today`), so time zones stay
client-driven.

### 5. Tools and admin

- Demo import and export per user (`--user=email`).
- Admin: delete a user with all their data, audit log of admin actions,
  then the Docker image and gateway route for the admin.

## Risks

- **A missed query leaks data.** The Prisma extension makes unscoped access
  fail loudly; the two-user tests catch the raw SQL.
- **Backfill on a big database.** Add columns nullable, backfill in batches,
  then add `NOT NULL` and the indexes, in separate migrations.
- **Background work** (rate fetching, notification sync) must loop over
  users instead of assuming one.
