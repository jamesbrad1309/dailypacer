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

## At a glance

| Area | Built | Open | Top open item (impact) |
| ---- | :---: | :--: | ---------------------- |
| System | 1 | 3 | Health checks for every service (3) |
| Money | 3 | 4 | Payee rules (3) |
| Habits | 1 | 2 | Rewards and points (2) |
| Tasks | 1 | 1 | Move tasks between lists (2) |
| Journal | 0 | 1 | Browse and delete entries (2) |
| Notifications | 0 | 1 | Inbox counts and pruning (2) |
| Data | 0 | 3 | Demo import and reset (3) |
| **Users & access** | 0 | 6 | Users list (5), waiting on [multi-user](multi-user-plan.md) |
| Admin app itself | 1 | 3 | Docker image behind sign-in (4) |

## Use cases

| Category | Status | Use case | Impact | Notes |
| -------- | :----: | -------- | :----: | ----- |
| **System** | ✅ | **Overview**: rows per table, migrations, API uptime | 4 | `/` page. `Query.adminOverview` → `GET /admin/overview` (`apps/api/src/admin`): `count()` per main table grouped by area, the newest applied Prisma migration, the API's Node version and uptime |
|  | ⬜ | **Health of every service** (gateway, BFF, API, Postgres) | 3 | Today the overview only proves the BFF and API answer. Add the BFF's own uptime and Postgres version/size |
|  | ⬜ | **Exchange-rate fetch history** and failures | 2 | Rates are fetched on a timer (`ExchangeRatesService`); failures only reach the logs |
|  | ⬜ | **Recent errors** from the logs | 2 | Needs a log store; pino writes to stdout only ([logging.md](../backend/logging.md)) |
| **Money** | ✅ | **Accounts**: list active and archived, archive / restore, make default | 4 | `/accounts`, tabs in `?view=`. Reuses `accounts`, `archivedAccounts`, `archiveAccount`, `unarchiveAccount`, `setDefaultAccount` |
|  | ✅ | **Categories**: spending and income trees, archive / restore | 3 | `/categories`. Built-in (system) categories can't be archived. Reuses `categories(includeArchived: true)` and `updateCategory(archived)` |
|  | ✅ | **Currencies**: rates, overrides, main currency, fetch today's rates | 3 | `/currencies`. Making a currency main asks first (it clears every override). Reuses `currencySettings`, `setMainCurrency`, `setExchangeRateOverride`, `refreshExchangeRates` |
|  | ⬜ | **Payee rules**: list, reorder, delete, apply to past transactions | 3 | Mutations exist (`payeeRules`, `applyPayeeRules`) |
|  | ⬜ | **Subscriptions**: list, cancel, delete | 2 | Mutations exist |
|  | ⬜ | **Budgets and savings goals**: list, delete | 2 | Mutations exist |
|  | ⬜ | **Delete an account** with its transactions | 2 | Needs a new API endpoint: today accounts can only be archived |
| **Habits** | ✅ | **Habits**: list active and archived with streaks and check-ins, archive / restore | 3 | `/habits`. Reuses `habits`, `archivedHabits`, `archiveHabit`, `unarchiveHabit` |
|  | ⬜ | **Rewards and points**: list rewards, undo a redemption | 2 | Mutations exist |
|  | ⬜ | **Delete a habit** with its history | 1 | Needs a new API endpoint: today habits can only be archived |
| **Tasks** | ✅ | **Task lists**: open and done counts, rename, delete (not the Inbox) | 3 | `/task-lists`. Delete asks first and says how many tasks go with it. Reuses `todoLists`, `updateTodoList`, `deleteTodoList` |
|  | ⬜ | **Move tasks between lists** in bulk | 2 | |
| **Journal** | ⬜ | **Browse and delete journal entries** | 2 | Personal data: decide with the multi-user plan who may read it |
| **Notifications** | ⬜ | **Inbox counts and pruning** | 2 | After the notifications inbox (PR #21) merges: counts by kind, prune done items now |
| **Data** | ⬜ | **Import the demo data** into an empty database | 3 | Today `pnpm demo:import` ([demo-data.md](../infra/demo-data.md)) |
|  | ⬜ | **Export the database** as a demo fixture or backup | 2 | Today `pnpm demo:export` |
|  | ⬜ | **Reset** (empty the database) | 2 | Destructive: only behind sign-in, and typed confirmation |
| **Users & access** | ⏸ | **Users list**: everyone with an account, last seen, status | 5 | Waiting on [multi-user](multi-user-plan.md): there's no `User` table yet; every row belongs to one implicit user |
|  | ⏸ | **Invite or create a user** | 4 | Phase 1 of the plan |
|  | ⏸ | **Disable / re-enable a user** (blocks sign-in, keeps data) | 4 | |
|  | ⏸ | **Roles**: `owner`, `admin`, `member` | 4 | Who may open the admin at all |
|  | ⏸ | **Delete a user and all their data** | 3 | Per-user cascade, after a typed confirmation |
|  | ⏸ | **Audit log** of admin actions | 3 | Who changed what, when |
| **Admin app itself** | ✅ | **Shell**: sidebar, "no sign-in" banner, error and empty states | 3 | [dashboard.md](dashboard.md) |
|  | ⬜ | **Sign-in and a role check** before any admin page | 5 | Replaces the bypass above; phase 1 of the multi-user plan |
|  | ⬜ | **Docker image and gateway route** (`/admin`) | 4 | Only after sign-in exists, so it's never exposed without it |
|  | ⬜ | **Vietnamese** | 1 | English only for now; the web app's i18n setup ([i18n.md](../frontend/i18n.md)) would carry over |
