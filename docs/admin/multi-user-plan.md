# Multi-user Plan

**Status: phases 1–3 built (users, sign-in, roles, per-user data); 4–5
planned.** People sign in with their own accounts and roles and see only
their own data; see [auth.md](../backend/auth.md).

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
| How people sign in | Email magic link · passkeys · password · external OIDC (Auth0, Clerk, Keycloak) | **Decided: email and password** (built). Magic links and passkeys can come later |
| Where the session lives | httpOnly cookie set by the BFF · bearer token in the SPA | **Decided: cookie** (built). The SPA never holds a token |
| How the API learns who's calling | Trust an `x-user-id` header from the BFF on the internal network · BFF forwards a signed token the API verifies | **Decided: the BFF forwards the session token**, which the API looks up (built), so a stray request to the API can't pick a user |
| Who can sign up | Admins only · open · both | **Decided: both.** Open sign-up is a normal one (signed straight in, own empty data); admins can still add people |
| Scoping in the API | Pass `userId` through every service call · request-scoped context (AsyncLocalStorage) plus a Prisma client extension that adds `where: { userId }` | **Decided: context + extension** (built, `ownership.ts`), with explicit `userId` in raw SQL |
| Per-user or shared | Exchange rates and service logos | Shared (market data and a cache); everything else per user |

## Phases

### 1. Users and sign-in (no scoping yet) ✅ built

- `User` (email, name, scrypt password hash, role `OWNER | ADMIN | MEMBER |
  VIEWER`, status `ACTIVE | PENDING | DISABLED`, lastSignInAt) and `Session`
  (hashed token, sliding 30-day expiry).
- Sign-in, sign-up (pending until approved), sign-out and change password;
  `Query.me` with the user's abilities. Sign-in pages in the web app and the
  admin; the admin is owners and admins only.
- The access rules are an ABAC policy in the API (`src/auth/policy.ts`),
  enforced on every route by a global guard.
- The first owner comes from `OWNER_EMAIL`/`OWNER_PASSWORD`, or is the first
  person to sign up in an empty database.
- Admin: Users list, add, approve, turn off, change role, reset password.
- (Until phase 3 everyone shared one dataset, so sign-ups waited for an
  admin's approval. With per-user data they're signed straight in.)

### 2. Ownership columns ✅ built

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

Built as migration `20261010120000_per_user_data`: today's rows go to the
oldest owner, or to an unclaimed owner the first sign-up claims. As planned,
except `MonthlyTotal` is owned through its account rather than its own
column (its raw `INSERT … ON CONFLICT` stays as it was).

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
| Seeded categories and the Inbox list | created per user (`UserSetupService`), not by a migration |

### 3. Scope every read and write ✅ built

- The guard already knows the user (`req.user`); a request context carries
  its `userId`; a Prisma client
  extension adds it to every query on an owned model and refuses one without
  it.
- Raw SQL needs it by hand: `transactions.service` (tag counts),
  `reports.service`, `monthly-totals.service`, `subscriptions.service`,
  `life-level.service`.
- Another user's id behaves like a missing row: 404, never 403, so ids
  can't be probed.
- Tested: unit tests for the extension's rewriting (`ownership.test.ts`), and
  a two-user run through the BFF: reads, filters, updates, links to the other
  user's rows (accounts, categories, tasks, dependencies, budgets, payee
  rules, journal triggers), reports, tags, list prefixes and the totals
  rebuild all stay inside each user's data.

### 4. Per-user settings

Main currency, language and time zone move onto the user. The client
already sends its local day and time (`today`), so time zones stay
client-driven.

### 5. Tools and admin

- ✅ Demo import and export per user (`--user=email`).
- Admin: delete a user with all their data, audit log of admin actions,
  then the Docker image and gateway route for the admin.
- The policy gains an ownership attribute: `app:read`/`app:write` check the
  resource's `userId` against the subject (owners and admins may still
  manage people, not read their data, unless decided otherwise).

## Risks

- **A missed query leaks data.** The Prisma extension makes unscoped access
  fail loudly; the two-user tests catch the raw SQL.
- **Backfill on a big database.** Add columns nullable, backfill in batches,
  then add `NOT NULL` and the indexes, in separate migrations.
- **Background work** (rate fetching, notification sync) must loop over
  users instead of assuming one.
