# Finance Use Cases

Uses the same format as the habit [use cases](../domain/use-cases.md).
**Impact score** (1–5): `5` core loop · `4` used daily or weekly ·
`3` meaningfully improves UX · `2` edge case / power user · `1` speculative.
**Status**: ✅ built · 🟡 partly built (the note says what's missing) ·
⬜ not built yet, as of 2026-10-04 (phases 1–5, see [index.md](index.md#whats-built)).
Re-verify against the code before trusting a ⬜. Rows are grouped by
category and sorted by impact within each group, and **Notes** link to
the doc that designs each one.

## At a glance

| Area | ✅ | 🟡 | ⬜ | Top open items (impact) |
| ---- | :-: | :-: | :-: | ----------------------- |
| Account setup | 12 | 0 | 0 | — |
| Quick log | 12 | 0 | 0 | — |
| Transactions | 7 | 0 | 0 | — |
| Categories | 4 | 0 | 0 | — |
| Budgets | 4 | 0 | 0 | — |
| Recurring & bills | 8 | 0 | 0 | — |
| Savings goals | 3 | 0 | 0 | — |
| Reports & insights | 5 | 0 | 0 | — |
| Languages & currency | 2 | 0 | 0 | — |
| Data in / out | 2 | 0 | 0 | — |

## Use cases

| Category | Status | Use case | Impact | Notes |
| -------- | :----: | -------- | :----: | ----- |
| **Account setup** | ✅ | **Add a bank account** with today's balance (no history needed) | 5 | `openingBalanceMinor` + `openingBalanceDate`, see [account-setup.md](account-setup.md) |
|  | ✅ | **Add a credit card** with credit limit, amount owed, statement day and due day | 5 | Type-specific `Account` columns, see [data-model.md](data-model.md) |
|  | ✅ | **See each account's balance**, and for cards the available credit and utilisation bar | 5 | Derived values table in [account-setup.md](account-setup.md) |
|  | ✅ | **Choose a default account** for quick log | 5 | `Account.isDefault`, exactly one, enforced by a partial unique index. Only spendable accounts (current, savings, card, cash) can be the default. |
|  | ✅ | **Update balance / reconcile** from the real balance, creating one adjustment | 4 | `reconcileAccount`, so missed logs don't break balances, see [account-setup.md](account-setup.md). Previews the adjustment before saving. |
|  | ✅ | **Add a loan** (owed, APR, monthly payment) and see its estimated payoff date | 4 | Amortisation formula in [account-setup.md](account-setup.md). Also flags a payment that doesn't cover the interest. |
|  | ✅ | **Card payment due soon** ("Amex due in 5 days") | 4 | `Account.nextDueDate`, amber within 7 days. Also listed under "Coming up" on Money setup. |
|  | ✅ | **Net worth**: assets minus everything owed | 4 | Sum of the balance loader across accounts; watch the 32-bit limit, see [money-handling.md](money-handling.md). Returns assets and owed as well as the total. |
|  | ✅ | **Pay off a card or loan** from a bank account without it counting as spending | 4 | A transfer, see [account-setup.md](account-setup.md). "Pay off" on the card or loan opens the transfer dialog with the amount owed filled in. |
|  | ✅ | **Track personal debts (IOUs)**: "I owe Sam £40", "Alex owes me £25", then settle up | 3 | `IOU` account type, see [account-setup.md](account-setup.md). "Settle up" is a transfer between the IOU and a bank account or wallet. |
|  | ✅ | **Reorder accounts**, which also sets the quick-log account switcher order | 2 | `Account.sortOrder`, `reorderAccounts`. Up/down buttons within a group; no drag and drop. |
|  | ✅ | **Archive a closed account** and keep its history | 2 | `Account.archivedAt`, same soft-delete as habits. Archived accounts can be restored. |
| **Quick log** | ✅ | **Log an expense as amount + one tap on a category** (under 5 s) | 5 | Tapping a category saves; everything else defaults, see [quick-log.md](quick-log.md) |
|  | ✅ | **Open quick log from anywhere** (➕ button, `n` key, deep link, PWA shortcut) | 5 | ➕ button, `n` key, `/log?amount=&category=` deep link, and a "Log an expense" shortcut on the installed app's icon (`public/manifest.webmanifest`; Android and desktop Chrome/Edge, not iOS). See "Getting to the log screen" in [quick-log.md](quick-log.md) |
|  | ✅ | **Undo** a log from the toast, with no confirmation dialogs | 5 | Reuses `deleteTransaction` |
|  | ✅ | **Presets**: one tap logs "☕ Flat white £3.40" | 4 | `QuickPreset` model, see [quick-log-implementation.md](quick-log-implementation.md) |
|  | ✅ | **Smart category chips** ranked by recency and time of day | 4 | Scoring in [quick-log-implementation.md](quick-log-implementation.md). Uses the user's time-zone offset to read the logged hour. |
|  | ✅ | **Log now, categorise later**: uncategorised entries land in a "To review" inbox | 4 | `categoryId: null` + `uncategorisedOnly` filter. Sidebar badge; focus moves to the next item after filing one. |
|  | ✅ | **Remember the account per category** (Fuel → Amex) | 3 | `lastAccountByCategory` in `quickLogContext` |
|  | ✅ | **One-line entry**: "lunch 12.50 @amex" | 3 | Client-side `parseQuickLog`, see [quick-log-implementation.md](quick-log-implementation.md). English and Vietnamese, accents optional; unit-tested. |
|  | ✅ | **Evening catch-up mode**: several entries in a row with the keypad kept open | 3 | See [quick-log.md](quick-log.md). "Log several (stay open)" shows today's entries under the sheet. |
|  | ✅ | **"Save as preset?"** suggested after 3 repeats in 30 days | 2 | `QuickLogPayload.suggestPreset` |
|  | ✅ | **No duplicate logs** from double taps or retries | 2 | `Transaction.clientId` upsert. Verified: 10 identical concurrent requests → 1 transaction. |
|  | ✅ | **"Split with…"**: log a £60 dinner as your £20, with Sam and Alex each owing you £20 | 3 | Quick log's "Split with…" picks people (IOU accounts, or adds one), and splits evenly or by typed amounts. Your share is the expense; each other share moves from the paying account to that person's IOU. Undo or delete removes the whole bill. See [quick-log.md](quick-log.md#split-with) |
| **Transactions** | ✅ | **Full transaction form** (payee, note, tags, any date) for when quick log isn't enough | 4 | Amount, date, account, category, payee, note and tags. `createTransaction`, see [graphql-schema.md](graphql-schema.md) |
|  | ✅ | **Edit or delete a transaction** | 4 | Deleting one leg of a transfer deletes both. Delete is undoable from a toast. |
|  | ✅ | **Pending transactions**: mark one as not gone through yet, confirm it later | 3 | `Transaction.status` PENDING/CLEARED. Counts in balances and reports; shown with a Pending badge; waits in To review until confirmed. Auto-logged charges start pending |
|  | ✅ | **Transfer between accounts** without it counting as spending | 4 | Two rows sharing `transferId`, see [data-model.md](data-model.md). Cross-currency transfers take the amount received, pre-filled from today's rate. Idempotent via `clientId`. |
|  | ✅ | **Search and filter** by date range, account, category, payee or text | 3 | `TransactionFilter` + cursor pagination, see [graphql-schema.md](graphql-schema.md). Month, account, category and payee/note search, all in the URL. |
|  | ✅ | **Split a transaction** across categories (e.g. one supermarket receipt covering groceries and household) | 2 | `TransactionSplit` rows; the transaction's own category is null. Monthly totals, budgets and reports count each part in its category, and filtering by a category finds split transactions with a part in it. Split from the full form (✂); the parts must add up. See [data-model.md](data-model.md#splits) |
|  | ✅ | **Tag transactions** ("holiday-2026", "work-expense") alongside the category | 2 | Tags field in the full form (commas, spaces or `#`; lowercased, `lib/tags.ts`), shown as `#tag` in the list. Editable on transfers and adjustments too. No filter by tag yet. `Transaction.tags` string array |
| **Categories** | ✅ | **Default category set** seeded on first run (Groceries, Rent, Transport, Eating out…) | 4 | `CategoriesService.seedDefaults()` on module init, see [backend-module.md](backend-module.md). 15 categories with English + Vietnamese parser aliases; names translated via `metadata.key`. |
|  | ✅ | **Category aliases** for the one-line parser ("latte", "starbucks" → Coffee) | 2 | `Category.metadata.aliases` |
|  | ✅ | **Custom categories** with icon and colour, grouped under parents ("Food › Eating out") | 3 | `/finance/categories`: create, edit (emoji, colour from a palette, aliases), archive and restore. Nested one level (`Category.parent`); pickers show subcategories under their parent. Renaming a built-in category keeps your name instead of the translation |
|  | ✅ | **Auto-categorise by payee rule** ("TESCO*" → Groceries) | 3 | `PayeeRule`: `*` matches anything; without one, the pattern matches anywhere in the payee; case, accents and punctuation don't matter. Tried first by quick log and CSV import, then payee history and category names. "Apply to To review" files what's already waiting; the form shows how many it would match. See [recurring-and-import.md](recurring-and-import.md) |
| **Budgets** | ✅ | **Monthly budget per category** | 4 | `Budget(categoryId, month)`, see [budgets-and-reports.md](budgets-and-reports.md). Carries forward from the month it's set; see [index.md](index.md#whats-built). |
|  | ✅ | **Budget vs actual** progress bars, coloured by pace ("68% spent, 50% of the month gone") | 4 | One `groupBy` per month + pace colouring, see [budgets-and-reports.md](budgets-and-reports.md). Status colour + icon + label, and an "on pace today" tick. |
|  | ✅ | **Rollover**: carry unspent budget into next month | 2 | Computed over a bounded window, not stored. 12-month window; an overspend never carries. |
|  | ✅ | **Alert when a category passes 80% / 100%** | 2 | In-app: a toast when a quick log crosses either line (`QuickLogPayload.budgetAlert`), and a "budgets need a look" panel plus badges on Budgets (`BudgetLine.alert`). Notifications are out of scope |
| **Recurring & bills** | ✅ | **Recurring transactions** (rent, salary, subscriptions) generated on schedule | 4 | Subscriptions either ask each time, or **auto-log**: each charge is logged on its date as a Pending transaction to confirm later. Salary is a money-in subscription. Lazy, idempotent catch-up, see [subscriptions.md](subscriptions.md#auto-log-and-pending-transactions) |
|  | ✅ | **Upcoming bills** for the next 30 days | 3 | Subscriptions' Upcoming tab (60 days) and "still to pay in the next 30 days". Card and IOU due dates stay in "Coming up" on Money setup |
|  | ✅ | **Subscription audit**: list every recurring expense with its yearly cost | 3 | Per month and per year totals in the main currency, and ≈ monthly cost for yearly plans. `subscriptionSummary` |
|  | ✅ | **Confirm or skip each charge**, with the amount actually taken | 3 | Confirm logs a transaction (idempotent); Skip for a charge not taken or already logged; Undo on both. Shown in To review |
|  | ✅ | **Free trials**: "trial ends 5 Oct, then £11.99 / month" | 3 | `trialEndsOn`; the first charge after it is marked |
|  | ✅ | **Charge calendar**: which day each subscription hits | 3 | Month grid with logos; choose a day for its charges and amounts |
|  | ✅ | **Price changes with history**, entered ahead if known | 2 | `SubscriptionPrice(effectiveFrom)`; each charge costs the price in effect on its date |
|  | ✅ | **Pause or cancel** without losing history, including a cancellation that takes effect later | 2 | `pausedAt`, `endsOn`; both undoable |
|  | ✅ | **Pick from a list of services with their logos** | 2 | ~80 built-in services (incl. Vietnamese), icons fetched once from the website and cached, see [subscriptions.md](subscriptions.md#the-service-list-and-logos) |
| **Savings goals** | ✅ | **Create a goal** (target amount, optional deadline, linked account) | 3 | `/finance/goals`. Linked, the account's balance is what's saved; unlinked, add or take out money by hand. Archive or delete. See [data-model.md](data-model.md#savings-goals) |
|  | ✅ | **Track progress** with "on track / behind" based on the deadline | 3 | On track when saving since the goal's start keeps up with the time gone (a tick on the bar shows where a steady pace would be); "past its date" once the deadline passes. `savings-goal.util.ts` |
|  | ✅ | **Required monthly saving** to reach the goal on time | 2 | `requiredPerMonthMinor`: what's left over the months left (at least one) |
| **Reports & insights** | ✅ | **Spend by category this month** (donut or bar chart) | 4 | `spendByCategory(month)`, see [budgets-and-reports.md](budgets-and-reports.md). Read from the `monthly_totals` aggregate, not computed per request. |
|  | ✅ | **Cash flow**: income vs expenses per month for the last 12 months | 4 | On Spending: paired columns, net in the tooltip, table view; click a month to open it. `cashFlow(to, months)` reads `monthly_totals`, "out" matches Spending's figure. See [budgets-and-reports.md](budgets-and-reports.md) |
|  | ✅ | **Month-over-month change per category** ("Eating out +42%") | 3 | Two `spendByCategory` calls, diffed on the client. Built into Spending (`previousSpentMinor`). |
|  | ✅ | **Top payees** | 2 | On Spending: the month's ten biggest, out minus refunds, payees matched ignoring case; each opens its transactions. `topPayees(from, to)` |
|  | ✅ | **Net worth over time** | 2 | On Spending: a line of net worth at each month's end over 12 months, with own/owe in the tooltip and a table view. Every account's opening balance plus all its transactions, each month at its own rate. `netWorthHistory(to, months)` |
| **Languages & currency** | ✅ | **Use the app in English or Vietnamese**, including amounts, dates and category names | 4 | See [i18n.md](../frontend/i18n.md). Amounts accept "12,50" and "12.50" |
|  | ✅ | **Choose the currencies I use**, and a main currency for totals | 4 | `/finance/currencies`: daily rates fetched automatically, overridable per currency; see [money-handling.md](money-handling.md#currencies) |
| **Data in / out** | ✅ | **CSV import** from a bank export with column mapping and duplicate detection | 4 | Parsed on the server; the upload is deleted once imported or cancelled. Column mapping + `importHash` dedupe, see [recurring-and-import.md](recurring-and-import.md) |
|  | ✅ | **CSV export** of transactions | 2 | "Export CSV" on Transactions pages through `transactions(filter)` for the month and filters shown and builds the file in the browser (`lib/csv-export.ts`): one row per split part, plain decimal amounts, formula-looking text defused, UTF-8 with BOM for Excel |

## Out of scope for v1

- Live bank sync (Open Banking / Plaid)
- Investment holdings, prices and portfolio performance
- Tax reporting, invoices, shared or household budgets
