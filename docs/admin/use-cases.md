# Admin Use Cases

What the admin dashboard (`apps/admin`, see [dashboard.md](dashboard.md))
needs to do. Same conventions as the product's
[use cases](../domain/use-cases.md): **Status** ✅ built · ⬜ not built yet ·
⏸ planned, waiting on another piece of work. **Impact** 1–5, how much an
operator suffers without it.

> **Sign-in required.** Owners and admins only: members and viewers who
> sign in get a 403 page, and the API refuses their admin calls anyway
> ([auth.md](../backend/auth.md)). The admin still has no Docker image,
> so it runs on a developer's machine.

## Scope

Accounts first: the admin manages money accounts, and their details come
next. Pages for categories, currencies, habits and task lists were tried and
removed (2026-10-08) to keep the focus; the web app still manages those.

## At a glance

| Area | Built | Open | Top open item (impact) |
| ---- | :---: | :--: | ---------------------- |
| System | 1 | 0 | — |
| **Accounts** | 3 | 6 | Account details page (5) |
| Errors & 404 | 7 | 0 | — |
| **Users & access** | 7 | 2 | Audit log (3) |
| Admin app itself | 2 | 2 | Docker image and gateway route (4) |

## Use cases

| Category | Status | Use case | Impact | Notes |
| -------- | :----: | -------- | :----: | ----- |
| **System** | ✅ | **Overview**: rows per table across everyone (counts only), migrations, API uptime | 4 | `/` page. `Query.adminOverview` → `GET /admin/overview` (`apps/api/src/admin`): `count()` per main table grouped by area, the newest applied Prisma migration, the API's Node version and uptime |
| **Accounts** | ✅ | **List my accounts**: active and archived, with type, institution, balance, start date | 5 | Data is per user, so these are the signed-in person's own. `/accounts`, tabs in `?view=` (an unknown value falls back to Active). Reuses `accounts` and `archivedAccounts` |
|  | ✅ | **Archive / restore** an account | 4 | `archiveAccount`, `unarchiveAccount`. Archiving the default hands "default" to another spendable account (the API does this) |
|  | ✅ | **Make an account the default** for quick log | 3 | `setDefaultAccount`. Offered only for spendable types (current, savings, credit card, cash), the same rule as the API's `SPENDABLE_TYPES` |
|  | ⬜ | **Account details page** (`/accounts/$id`): every field, balance history, recent transactions | 5 | Next. A loader that gets `NOT_FOUND` throws `notFound()`, so a bad id shows the 404 page |
|  | ⬜ | **Edit an account**: name, institution, last 4, card and loan terms | 4 | `updateAccount` exists; the type can't change |
|  | ⬜ | **Create an account** | 3 | `createAccount` exists |
|  | ⬜ | **Reconcile** (set the real balance) | 3 | `reconcileAccount` exists |
|  | ⬜ | **Reorder accounts** | 2 | `reorderAccounts` exists |
|  | ⬜ | **Delete an account** with its transactions | 2 | Needs a new API endpoint: today accounts can only be archived |
| **Errors & 404** | ✅ | **404 page** for any unknown URL | 4 | Root `notFoundComponent` and the router's `defaultNotFoundComponent`: shows the path, links to Accounts and Overview |
|  | ✅ | **Page failed to load**, explained by cause | 5 | `RouteError` + `describeError` (`lib/errors.ts`): admin server down, BFF down (proxy 502/503/504), API down (`UPSTREAM_UNAVAILABLE`), BFF out of date (`GRAPHQL_VALIDATION_FAILED`), server error (5xx), each with what to do, a "Details" disclosure and Try again |
|  | ✅ | **Action failed** (archive, make default) | 4 | `useAction` + `ActionError`: an inline panel above the table, dismissible; the table stays usable |
|  | ✅ | **Record gone** (deleted elsewhere) | 3 | An action that gets `NOT_FOUND` says so and refetches the list |
|  | ✅ | **Offline** | 3 | Banner while the browser is offline; failures while offline say so instead of blaming a server |
|  | ✅ | **Code couldn't load** (rebuilt or stopped admin) | 2 | A failed code-split chunk asks for a reload |
|  | ✅ | **The shell itself crashed** | 2 | Root `errorComponent` and `AppErrorBoundary` show a full-page `AppCrash` with Try again / Reload |
| **Users & access** | ✅ | **Users list**: name, email, role, status, last sign-in; pending sign-ups first | 5 | `/users`. `Query.users` → `GET /users` (`users:list`) |
|  | ✅ | **Add a user** with a role and a password; active at once | 4 | `createUser`. Admins can give member or viewer, owners any role |
|  | ✅ | **Approve or decline** a sign-up | 4 | `updateUser(status)`. Sign-ups wait as pending viewers |
|  | ✅ | **Turn a user off / on** (blocks sign-in, ends their sessions, keeps data) | 4 | `updateUser(status: DISABLED)` |
|  | ✅ | **Change someone's role** | 4 | A select per row, listing only roles you may give |
|  | ✅ | **Reset someone's password** (signs them out everywhere) | 3 | `resetUserPassword` |
|  | ✅ | **Only what the rules allow is offered** | 3 | `User.permissions` from the API's policy: no controls on your own row, admins can't touch owners or admins |
|  | ⬜ | **Delete a user** with all their data | 2 | Every `userId` cascades, so it's one delete; needs a typed confirmation. Turning off covers most needs |
|  | ⬜ | **Audit log** of admin actions | 3 | Who changed what, when; today only the API's logs |
| **Admin app itself** | ✅ | **Shell**: sidebar, signed-in user with sign out, loading skeletons | 3 | [dashboard.md](dashboard.md) |
|  | ✅ | **Sign-in and a role check** before any admin page | 5 | `/sign-in`; members and viewers get a 403 page (`abilities.openAdmin`) |
|  | ⬜ | **Docker image and gateway route** (`/admin`) | 4 | Now possible: sign-in exists |
|  | ⬜ | **Vietnamese** | 1 | English only for now; the web app's i18n setup ([i18n.md](../frontend/i18n.md)) would carry over |
