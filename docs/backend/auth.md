# Sign-in and Access Rules

Email and password sign-in, server-side sessions, and attribute-based access
control (ABAC) for the web app, the admin dashboard and the API. **Everyone
signed in shares the one dataset for now**; giving each person their own
data is phase 2 of the [multi-user plan](../admin/multi-user-plan.md).

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

| Action | Owner | Admin | Member | Viewer |
| ------ | :---: | :---: | :----: | :----: |
| `app:read`: see habits, money, tasks, journal, notifications | ✅ | ✅ | ✅ | ✅ |
| `app:write`: change them | ✅ | ✅ | ✅ | — |
| `admin:open`, `users:list` | ✅ | ✅ | — | — |
| `users:create` | any role | member, viewer | — | — |
| `user:change-role`, `user:change-status`, `user:reset-password`, `user:update` | anyone but themself | members and viewers | — | — |
| `self:change-password` | ✅ | ✅ | ✅ | ✅ |

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

- **Sign-up** (`/sign-up` in the web app) creates a **pending viewer**, who
  can't sign in until an owner or admin approves them on the admin's Users
  page. Anything else would let anyone who can reach the app read
  everyone's data. **Exception:** the first account in an empty database
  becomes its owner and is signed straight in.
- **First owner from the environment:** with `OWNER_EMAIL` and
  `OWNER_PASSWORD` set, the API creates that owner on start if there's no
  owner yet (or promotes the existing account with that email).
- **Admins add people** from the admin's Users page with a role and a
  password; they're active at once.
- **Approve / decline / turn off / turn on** set the status. Turning
  someone off ends all their sessions.
- **Reset password** (admin) sets a new one and ends all their sessions.
  **Change password** (yourself, from the web app's account menu) needs
  the current one and ends your other sessions.

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
| `POST /auth/password` | `self:change-password` |
| `GET /users`, `POST /users` | `users:list`, `users:create` |
| `PATCH /users/:id`, `POST /users/:id/password` | decided per target in `UsersService` |

## Not yet

- Per-user data (each person sees only their own): the multi-user plan's
  phase 2–3.
- Email: verification, "forgot password" links, notifying admins of a
  pending sign-up (with [email-and-notifications.md](email-and-notifications.md)).
- Two-factor sign-in, passkeys, "sign out other devices" as a button.
- An audit log of admin actions.
