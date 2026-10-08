# Notifications inbox

An in-app inbox modelled on GitHub's: a bell in the app bar with the
unread count, and `/notifications` with **Inbox**, **Unread**, **Saved** and
**Done**, filters by what each one is about, bulk marking, and keys on a
row. Email and push are still the plan in
[Email & notifications](email-and-notifications.md); this is the in-app
channel they'd send alongside.

## What makes a notification

Nothing emits notifications as things happen. A **sync** looks at what's
true now and turns it into inbox items, so no write path in tasks, finance
or habits had to change, and nothing is missed if the app was closed.

| Reason | Kind | When | Ongoing |
| ------ | ---- | ---- | :-----: |
| Task | `task.dueToday` / `task.overdue` | An open task due today, or before (same notification: it turns overdue and comes back unread) | ✓ |
| Task | `task.inbox` | Open tasks in the Inbox list with no day planned | ✓ |
| Money | `money.toReview` | Uncategorised transactions (not transfers) | ✓ |
| Money | `money.pendingCharges` | Subscription charges waiting to be confirmed | ✓ |
| Money | `money.budget` | A category passes 80% (`near`) or 100% (`reached`) of this month's budget, once per level per month | |
| Money | `money.cardDue` | A card's payment due within 7 days while something is owed | ✓ |
| Money | `money.goalReached` | A savings goal reached | |
| Habit | `habit.due` | A due habit past its start time, not done yet | ✓ |
| Habit | `habit.streakAtRisk` | From 20:00, a due habit with a streak of 3+ not done yet | ✓ |
| Habit | `habit.streakMilestone` | Done today on a 7, 14, 30, 50, 100, 200 or 365-day streak | |
| Achievement | `achievement.unlocked` | A badge earned in the last 7 days | |
| Achievement | `achievement.levelUp` | The dashboard level, once per level from 2 | |
| Achievement | `achievement.challengeWon` | A challenge won in the last 7 days | |

**Ongoing** kinds hold only while their condition does: once a sync no
longer finds one (the task was done, the money filed, the habit ticked), it
is marked done. Events stay until you clear them. Badges and challenges
only count from the last week, so the first sync doesn't replay history.

## How the sync works

`apps/api/src/notifications/`:

- `NotificationSourcesService` asks tasks, money, cards, habits and
  achievements for **candidates**: `{ key, kind, params, link, fingerprint }`.
  Each source runs on its own. One that throws is logged and skipped, and
  resolves nothing, so an error never empties the inbox.
- `planSync` (`notification.util.ts`, pure and tested) compares them with
  what's stored:
  - a new `key` is created (unique, so a sync never makes it twice:
    `task-due:<taskId>:<dueOn>`, `budget:<categoryId>:<month>:<level>`);
  - a changed **fingerprint** brings it back to the top, unread, even if
    it was done. Counts use `resurface: "grew"`, so 3 → 5 uncategorised
    re-surfaces and 5 → 3 only updates the number;
  - other changes (a renamed task) update quietly;
  - an open ongoing notification with no candidate is marked done.
- Done notifications older than 90 days are deleted, unless saved or still
  true (that would bring them back as new).

The sync runs in the user's time: `POST /notifications/sync { today, time }`
with their local day and `HH:mm`. The BFF calls it before
`notifications(clock)` and `notificationCounts(clock)`; the bell asks every
minute and when the tab comes back. Syncs within 30 seconds of the last one
(same day) are skipped.

## Stored shape

`Notification`: `key` (unique), `kind`, `params` (JSON), `link`,
`fingerprint`, `surfacedAt` (the inbox's order), `readAt`, `doneAt`,
`savedAt`. The API stores what happened, never the sentence: the web app
words each kind from its params (`hooks/useNotificationText.ts`) in the
user's language, so switching language rewords the whole inbox.

## API and GraphQL

| REST (`apps/api`) | GraphQL (`apps/bff`) |
| ----------------- | -------------------- |
| `POST /notifications/sync` | (run by the queries below when given `clock`) |
| `GET /notifications?view&reason&first&after` | `notifications(view, reason, first, after, clock)`, cursor-paginated |
| `GET /notifications/counts` | `notificationCounts(clock)`: inbox, unread, unread per reason |
| `POST /notifications/mark { ids, read?, done?, saved? }` | `markNotifications(ids, read, done, saved)`; done also marks read |
| `POST /notifications/read-all { reason? }` | `markAllNotificationsRead(reason)` |

## Web

- **Bell** (`components/layout/NotificationBell.tsx`): unread count, links
  to the inbox. The sidebar's Notifications entry (`g i`) shows the same
  count from the cache.
- **Inbox** (`components/notifications/NotificationsView.tsx`, route
  `/notifications?view=&reason=`): views and reason filters with unread
  counts; select rows (or all) to mark read, unread, saved or done; "Mark
  all as read"; Undo on the toast after marking done. Opening a
  notification marks it read and follows its link.
- **Keys** on a focused row: `E` done (or back to the inbox), `Shift+I`
  read, `Shift+U` unread, `S` save. They're in the `?` cheat sheet.

## Not built

Push and email delivery, per-reason preferences, and a quiet-hours setting.
Those belong with the queue in [Email & notifications](email-and-notifications.md).
