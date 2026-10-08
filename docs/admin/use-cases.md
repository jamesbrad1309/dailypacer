# Admin Use Cases

What the admin dashboard (`apps/admin`, see [dashboard.md](dashboard.md))
needs to do. Same conventions as the product's
[use cases](../domain/use-cases.md): **Status** ✅ built · ⬜ not built yet ·
⏸ planned, waiting on another piece of work. **Impact** 1–5, how much an
operator suffers without it.

> **Authentication is bypassed for now.** There's no sign-in anywhere in
> DailyPacer yet: the admin talks to the same unauthenticated BFF as the web
> app, and anyone who can reach port 5174 can change the data. It's kept to
> `127.0.0.1` and has no Docker image, so it only runs on a developer's
> machine. Sign-in and roles arrive with the
> [multi-user plan](multi-user-plan.md); until then every row below is
> "local only".

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
| **Users & access** | 0 | 6 | Users list (5), waiting on [multi-user](multi-user-plan.md) |
| Admin app itself | 1 | 3 | Sign-in and a role check (5) |

## Use cases

| Category | Status | Use case | Impact | Notes |
| -------- | :----: | -------- | :----: | ----- |
| **System** | ✅ | **Overview**: rows per table, migrations, API uptime | 4 | `/` page. `Query.adminOverview` → `GET /admin/overview` (`apps/api/src/admin`): `count()` per main table grouped by area, the newest applied Prisma migration, the API's Node version and uptime |
| **Accounts** | ✅ | **List accounts**: active and archived, with type, institution, balance, start date | 5 | `/accounts`, tabs in `?view=` (an unknown value falls back to Active). Reuses `accounts` and `archivedAccounts` |
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
| **Users & access** | ⏸ | **Users list**: everyone with an account, last seen, status | 5 | Waiting on [multi-user](multi-user-plan.md): there's no `User` table yet; every row belongs to one implicit user |
|  | ⏸ | **Invite or create a user** | 4 | Phase 1 of the plan |
|  | ⏸ | **Disable / re-enable a user** (blocks sign-in, keeps data) | 4 | |
|  | ⏸ | **Roles**: `owner`, `admin`, `member` | 4 | Who may open the admin at all |
|  | ⏸ | **Delete a user and all their data** | 3 | Per-user cascade, after a typed confirmation |
|  | ⏸ | **Audit log** of admin actions | 3 | Who changed what, when |
| **Admin app itself** | ✅ | **Shell**: sidebar, "no sign-in" banner, loading skeletons | 3 | [dashboard.md](dashboard.md) |
|  | ⬜ | **Sign-in and a role check** before any admin page | 5 | Replaces the bypass above; phase 1 of the multi-user plan |
|  | ⬜ | **Docker image and gateway route** (`/admin`) | 4 | Only after sign-in exists, so it's never exposed without it |
|  | ⬜ | **Vietnamese** | 1 | English only for now; the web app's i18n setup ([i18n.md](../frontend/i18n.md)) would carry over |
