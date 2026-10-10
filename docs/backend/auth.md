# Sign-in and Access Rules

Email and password sign-in, server-side sessions, attribute-based access
control (ABAC) for the web app, the admin dashboard and the API, and
**per-user data**: each person sees and changes only their own habits,
money, tasks and journal ([below](#per-user-data)).

## How a request is checked

```
browser ──cookie──▶ BFF ──Authorization: Bearer <token>──▶ API: AuthGuard ──▶ policy ──▶ handler
```

1. **Browser → BFF.** The session is one httpOnly cookie,
   `dailypacer_session`, holding a random token. Scripts can't read it;
   `SameSite=Lax` keeps other sites from sending it; it's `Secure` over
   HTTPS (`SESSION_COOKIE_SECURE`, default `auto`). Apollo Server's CSRF
   protection is on as well.
2. **BFF → API.** The BFF forwards the token as `Authorization: Bearer` on
   every call (`clients/api-client.ts`, and the upload and logo routes). It
   decides nothing itself.
3. **API: `AuthGuard`** (`src/auth/auth.guard.ts`, global) finds the session
   and asks the policy whether the route's action is allowed. Every route is
   closed unless marked `@Public()` (sign-in, sign-up, health). The action
   is `@Authorize(...)` on the route, else `app:read` for GET and
   `app:write` for anything else.
4. **Per-user decisions** (changing someone's role) need that user's
   attributes, so `UsersService` asks the policy again with them loaded.

The clients' sign-in gates (root `beforeLoad` in the web app and the
admin) only decide where to send people; the API enforces everything.

## Roles and the policy

`src/auth/policy.ts` is the whole rulebook: one pure function,
`decide(subject, request)`, tested in `policy.test.ts`.

| Attribute | Of | Used for |
| --------- | -- | -------- |
| `role`: OWNER, ADMIN, MEMBER, VIEWER | subject, target user | what each may do, whom they may manage |
| `status`: ACTIVE, PENDING, DISABLED | subject | only ACTIVE accounts can do anything |
| `id` | subject vs target | nobody changes their own access |
| new `role` | the request | admins may only give MEMBER or VIEWER |
| `userId` (owner) | the data | everyone sees and changes only their own rows, whatever their role |

Roles don't replace the attributes; a role is one of them, a named bundle of
what someone may do, simpler to give a person than separate permissions.
Rules that depend on more than the role (nobody changes their own access,
admins manage only members and viewers, a disabled owner can do nothing)
sit in `decide`. Ownership isn't checked there: it's enforced in the data
layer for every query (see [Per-user data](#per-user-data)), so even an
owner never sees another user's habits or money.

| Action | Owner | Admin | Member | Viewer |
| ------ | :---: | :---: | :----: | :----: |
| `app:read`: see your own habits, money, tasks, journal, notifications | ✅ | ✅ | ✅ | ✅ |
| `app:write`: change them | ✅ | ✅ | ✅ | — |
| `admin:open`, `users:list` | ✅ | ✅ | — | — |
| `users:create` | any role | member, viewer | — | — |
| `user:change-role`, `user:change-status`, `user:reset-password`, `user:update` | anyone but themself | members and viewers | — | — |
| `self:change-password`, `self:update` (your onboarding and settings) | ✅ | ✅ | ✅ | ✅ |

Notes:
- Because no one can change their own role or status, there's always at
  least one active owner.
- `POST /notifications/sync` counts as `app:read`: it derives the inbox
  from what's true now, so a viewer reading it may run it. Marking items
  read or done is a write.
- The API also tells clients what the user may do so they can hide what
  won't work: `Me.abilities` (`write`, `openAdmin`, `manageUsers`,
  `assignableRoles`) and, per user in the admin, `User.permissions`. Both
  come from the same policy function.

## Accounts

- **Sign-up** (`/sign-up` in the web app) is a normal one: name, email,
  password (8+ characters, with a show/hide toggle), and you're signed
  straight in as a **member** with your own empty data, then go to
  onboarding ([below](#onboarding)). The first person to sign up becomes the
  owner instead (only when there's no account yet, so in practice the admin
  below is always first).
- **The admin account:** on every start the API makes sure the
  `OWNER_EMAIL` owner exists: by default `admin@dailypacer.local` with
  password `dailypaceradmin123`. A missing one is created (skipping
  onboarding); an existing one keeps its password, and is made an active
  owner again only if there's no other active owner. Set `OWNER_EMAIL`,
  `OWNER_PASSWORD` and `OWNER_NAME` to change it, and do for anything
  reachable by others.
- **The unclaimed owner:** data from before accounts existed belongs to a
  placeholder owner (`owner@unclaimed.invalid`, can't sign in, hidden from
  the Users page) made by the per-user migration. The admin account claims
  it, data and all, when it's created.
- **Every new user starts with** the default categories, GBP as main
  currency and an Inbox list (`UserSetupService`); sign-in also fills in
  anything missing for older accounts.
- **Admins add people** from the admin's Users page with a role and a
  password; they're active at once.
- **Approve / decline / turn off / turn on** set the status. Turning
  someone off ends all their sessions.
- **Reset password** (admin) sets a new one and ends all their sessions.
  **Change password** (yourself, from the web app's account menu) needs
  the current one and ends your other sessions.

## Onboarding

After signing up, the web app walks a new person through three steps at
`/welcome`: **Basics** (language, main currency), **Money** (add accounts
with today's balance) and **Habits** (pick starters from the templates).

- Every step can be skipped, and "Finish later" leaves for the app. The step
  they're on is saved (`User.onboardingStep`) as they move, so the next
  visit (a new tab, or signing in on another device) resumes there.
  "Finish later" lasts for the browser tab (`sessionStorage`).
- Finishing sets `User.onboardedAt`; until then the root route sends them
  to `/welcome`. People who existed before onboarding, and anyone who
  takes over the unclaimed owner's data, count as onboarded.
- "Set-up guide" in the account menu reopens it at any time.
- API: `POST /auth/onboarding { step }` or `{ done: true }` (`self:update`,
  allowed to every active user); GraphQL `Me.onboarding` and
  `updateOnboarding(step, done)`. Steps: `src/auth/onboarding.ts`.

## Per-user data

Every top-level table (habits, routines, rewards, points spends, journal
entries, accounts, categories, transactions, quick presets, budgets,
currencies, subscriptions, lists, tasks, savings goals, payee rules,
notifications) has a `userId`. Rows below them (habit entries, freezes,
challenges, pauses, routine habits, splits, subscription prices and charges,
board columns, task dependencies, goal contributions, monthly totals) belong
to their parent's owner. Exchange rates and logos are shared.

It's enforced in one place, `src/common/database/ownership.ts`, a Prisma
extension every query goes through:

- **Request context.** A middleware opens an AsyncLocalStorage context per
  request; `AuthGuard` puts the user in it (`request-context.ts`). Scripts
  run `asUser(id, …)`; the admin's row counts run `asSystem(…)`. A query on
  an owned model with no user fails rather than returning everyone's rows.
- **Reads, updates, deletes** get `AND userId = me` (or `AND parent.userId =
  me` for child rows), so another user's id behaves exactly like a missing
  one: 404, never 403.
- **Creates** get the user as owner. The column's database default reads a
  setting that's never set, so an insert that skipped the extension fails
  instead of making a row nobody owns.
- **Links between rows** (a transaction's category, a task's dependency,
  nested creates) are checked: pointing at another user's row is a 404.
- **Raw SQL** can't be seen by the extension, so it adds
  `currentUserId()` itself (reports, life level, tags, locks, the monthly
  totals rebuild).
- **Keys that were global are per user:** list prefixes (two people can both
  have `HOME-1`), currencies and the main currency, quick-log client ids,
  notification keys, the default account, top-level category names.
- **CSV uploads** sit in a folder per user.
- **Adding a model:** start-up fails until it's listed in `OWNED_BY_COLUMN`,
  `OWNED_VIA` or `SHARED`.

Owners and admins manage people but don't see anyone else's data. The
admin's Overview counts rows across everyone (numbers only); its Accounts
page shows the signed-in person's own accounts.

## Passwords and sessions

- **Hashing:** Node's scrypt (N=16384, r=8, p=1, 16-byte salt), stored as
  `scrypt$N$r$p$salt$hash` so the cost can rise later
  (`src/auth/password.ts`). Passwords are NFKC-normalised, 8–200 characters.
- **Sign-in** gives the same answer, "That email and password don't
  match", for an unknown email and a wrong password, and takes as long
  either way (it hashes against a dummy). "Pending" and "turned off" are
  only said after the right password.
- **Throttling:** 5 wrong passwords for one email within 15 minutes locks
  it for the rest of the window (`sign-in-throttle.ts`). In memory, so per
  API process; the gateway's rate limit on `/graphql` sits in front.
- **Sessions** (`sessions` table) store only the token's SHA-256, so a
  database leak doesn't hand out live sessions. They last 30 days, sliding
  forward when used (updated at most hourly). Lookups are cached for 30 s
  per process, and ending or changing a user clears their entries at once.
  With several API instances, another instance could honour a turned-off
  session for up to 30 s.
- **Logs** never contain passwords, tokens, cookies or `set-cookie` (pino
  redaction in both services).

## Errors clients see

GraphQL `extensions.code` (see [graphql-bff.md](graphql-bff.md)) plus a
stable `extensions.reason` the web app translates (`auth.errors.*`):

| Code | Reasons |
| ---- | ------- |
| `UNAUTHENTICATED` | `WRONG_CREDENTIALS`, `SIGNED_OUT` |
| `FORBIDDEN` | `ACCOUNT_PENDING`, `ACCOUNT_DISABLED`, `ACCOUNT_INACTIVE`, `READ_ONLY`, `MANAGERS_ONLY`, `OWNER_ONLY`, `SELF_ACCESS` |
| `CONFLICT` | `EMAIL_TAKEN` |
| `TOO_MANY_REQUESTS` | `TOO_MANY_ATTEMPTS` |
| `BAD_USER_INPUT` | `WRONG_PASSWORD` (changing your password) |

In the web app, an `UNAUTHENTICATED` error on any request but the auth ones
means the session ended: the cache is cleared and the person goes to
`/sign-in?ended=true`, then back to where they were. A `FORBIDDEN` mutation
shows a toast saying why ("You're a viewer…"), and viewers see a read-only
banner. The admin shows a 403 page to signed-in members and viewers.

## API endpoints

| Endpoint | Action |
| -------- | ------ |
| `POST /auth/sign-in`, `POST /auth/sign-up` | public |
| `GET /auth/me`, `POST /auth/sign-out` | any signed-in user |
| `POST /auth/onboarding` | `self:update` |
| `POST /auth/password` | `self:change-password` |
| `GET /users`, `POST /users` | `users:list`, `users:create` |
| `PATCH /users/:id`, `POST /users/:id/password` | decided per target in `UsersService` |

## Not yet

- Email: verification, "forgot password" links, notifying admins of a
  pending sign-up (with [email-and-notifications.md](email-and-notifications.md)).
- Two-factor sign-in, passkeys, "sign out other devices" as a button.
- An audit log of admin actions.
- Deleting a user (their data would go with them: every `userId` cascades).
