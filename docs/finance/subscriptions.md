# Subscriptions

What's charged, when, and how much: Netflix, Spotify, the gym, the phone
bill. Each subscription has a price, a billing schedule and the account it's
charged to. Charges are **confirmed one at a time**: nothing reaches an
account until you say it was taken. Built at `/finance/subscriptions`.

## How a charge works

```
schedule ──► due date ──► PENDING ──┬─ Confirm ─► CONFIRMED + a transaction
                         (in To      │               (Undo deletes it → PENDING)
                          review)    └─ Skip ────► SKIPPED
                                                     (Undo → PENDING)
later dates ─► UPCOMING (not stored; computed)
```

- **Charge dates are computed, never stored ahead of time.** Every charge
  is `firstChargeOn` plus a whole number of intervals (every N weeks,
  months or years), in `finance/subscription-schedule.util.ts` (pure,
  unit-tested). Months count from the anchor's day, not the previous
  charge, so a charge on the 31st falls on 28 Feb and is back on the 31st
  in March, which is how card billers behave.
- **Only answers are stored.** A `SubscriptionCharge` row records a
  confirmed or skipped charge. A due date without a row is pending.
- **Confirm logs a real transaction** (source `"recurring"`, payee = the
  subscription's name, its category), with an editable amount for when the
  charge differs from the price (currency conversion, a one-off). The
  transaction's `clientId` is `subscription:<id>:<dueOn>`, so double taps
  and retries log it once. Ten concurrent confirms were checked to create
  one transaction.
- **Deleting the transaction reopens the charge.** The charge row
  references it with `ON DELETE CASCADE`, so deleting it from the
  transaction list, or pressing Undo, puts the charge back to pending. The
  monthly totals follow, because the delete goes through
  `TransactionsService.remove`.
- **Old charges are never asked about.** `askFrom` is the day a
  subscription was added (or resumed, or reactivated after it had ended).
  Adding a two-year-old Netflix subscription doesn't produce 24 prompts.

Pending charges appear in **To review** on `/finance/transactions` (the
inbox count includes them) and at the top of the Subscriptions page.

## What it tracks

| Feature | How |
| ------- | --- |
| Price history | `SubscriptionPrice(amountMinor, effectiveFrom)`. A charge costs the price in effect on its date, so a rise can be entered ahead ("£12.99 from 1 Nov"). Confirmed charges show what was actually logged |
| Free trial | `trialEndsOn`; the first charge is the day it ends. Status `TRIAL`, and that charge is marked "First charge after trial" |
| Pause | `pausedAt`: no upcoming charges. Charges that fell due while paused are never asked about |
| Cancel | `endsOn` (exclusive), which can be in the future: status `ENDING` ("runs until 15 Oct"), then `ENDED`. Undo cancellation clears it |
| Delete | Removes the subscription, prices and answers; transactions already logged stay |
| Totals | Per month and per year at current prices, in the main currency (`subscriptionSummary`), plus what's still to pay over the next 30 days |
| Calendar | A month grid of logos per day; a pending charge has an amber ring, a skipped one is greyed out |

## The service list and logos

- **Catalog**: `finance/subscription-catalog.ts`, about 80 services with a
  name, website, usual category and search aliases, including Vietnamese
  ones (FPT Play, VieON, Zing MP3, Viettel…). Search ignores case and
  accents. No prices: they vary by country and plan. Anything not listed is
  added by name and website.
- **Logos** come from the service's website icon. `LogosService` asks
  Google's favicon service (128 px), then DuckDuckGo's, **once per
  domain**, and keeps the image in `service_logos`. The browser loads
  `/logos/<domain>` from our own origin (gateway → BFF → API), cached for a
  week, so it never calls a third party. The domain is only ever put into
  those two fixed URLs, so it can't point the server anywhere else. Only
  raster images up to 256 KB are kept (no SVG, which could run script
  from our origin), and "no icon" is remembered for a week before retrying.
  Without a logo the UI shows the name's first letter on a colour.
- A website typed as a URL (`https://www.Netflix.com/browse`) is stored as
  its hostname (`netflix.com`), so every copy shares one cached logo.

## API and GraphQL

REST (`apps/api/src/finance/subscriptions.controller.ts`); every read takes
the user's `?today=YYYY-MM-DD`:

- `GET /subscriptions[?includeEnded=true]`, `GET /subscriptions/:id`,
  `GET /subscriptions/services?q=`, `GET /subscriptions/summary`,
  `GET /subscriptions/charges?from&to`, `GET /subscriptions/pending`
- `POST /subscriptions`, `PATCH /subscriptions/:id`, `DELETE /subscriptions/:id`
- `POST /subscriptions/:id/{price,pause,resume,cancel,reactivate}`
- `POST /subscriptions/:id/charges/{confirm,skip,reopen}` with `{ dueOn }`
- `GET /logos/:domain`
- `GET /transactions/to-review-count` now returns
  `{ count, uncategorised, charges }`

GraphQL (`graphql/finance/subscriptions.schema.graphql`): `subscriptions`,
`subscription`, `subscriptionServices`, `subscriptionCharges`,
`pendingSubscriptionCharges`, `subscriptionSummary`; mutations for each
REST action; `toReviewCount(today)`. `SubscriptionCharge.id` is
`<subscriptionId>:<dueOn>`.

## Not built yet

- **Auto-posting** (rent, salary): a rule that logs itself without asking,
  as designed in [recurring-and-import.md](recurring-and-import.md#recurring-rules).
  It could be a flag on `Subscription`.
- **Matching an imported CSV row** to a pending charge. For now, Skip a
  charge the import already logged.
- **Notifications** before a charge or a trial ends (notifications are out
  of scope in v1).
