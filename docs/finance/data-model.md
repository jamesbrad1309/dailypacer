# Finance Data Model

These models are added to `apps/api/prisma/schema.prisma` next to `Habit` and
`HabitEntry`. All amounts are integer minor units (see
[money-handling.md](money-handling.md)).

```prisma
enum AccountType {
  CURRENT
  SAVINGS
  CREDIT_CARD
  LOAN
  IOU          // personal debt with a person, + = they owe you, − = you owe them
  CASH
  INVESTMENT
}

model Account {
  id                  String      @id @default(uuid())
  name                String
  type                AccountType
  currency            String      @default("GBP") // ISO 4217
  institution         String?     // bank / lender name, or the person for an IOU
  last4               String?     // display only, never a full card number
  icon                String?
  color               String?
  sortOrder           Int         @default(0)
  /// Exactly one account is the default; quick log uses it when none is chosen.
  isDefault           Boolean     @default(false)

  /// Balance on the day tracking started. Owed amounts are stored negative.
  openingBalanceMinor Int         @default(0)
  openingBalanceDate  DateTime    @db.Date
  lastReconciledAt    DateTime?

  // Credit card (null for other types)
  creditLimitMinor    Int?
  statementDay        Int?        // 1–31, clamped to month length
  paymentDueDay       Int?        // 1–31
  minPaymentMinor     Int?

  // Credit card + loan
  aprBps              Int?        // APR in basis points: 1999 = 19.99%

  // Loan (null for other types)
  monthlyPaymentMinor Int?
  loanStartDate       DateTime?   @db.Date
  termMonths          Int?

  // IOU
  dueDate             DateTime?   @db.Date

  archivedAt          DateTime?
  metadata            Json        @default("{}") // e.g. saved CSV column mapping
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  transactions Transaction[]
  goals        SavingsGoal[]
  presets      QuickPreset[]

  @@map("accounts")
}

model Category {
  id        String     @id @default(uuid())
  name      String
  icon      String?
  color     String?
  kind      String     @default("expense") // "expense" | "income"
  parentId  String?
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryTree")
  archivedAt DateTime?
  /// Built-in categories ("Adjustment") that reports ignore and users can't delete.
  isSystem   Boolean    @default(false)
  metadata   Json       @default("{}") // aliases for the quick-log parser, payee rules

  transactions Transaction[]
  budgets      Budget[]
  presets      QuickPreset[]

  @@unique([parentId, name])
  @@map("categories")
}

model Transaction {
  id          String    @id @default(uuid())
  accountId   String
  account     Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  categoryId  String?
  category    Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  date        DateTime  @db.Date
  amountMinor Int                      // negative = outflow
  payee       String?
  note        String?
  tags        String[]  @default([])
  /// Both legs of a transfer share this id; excluded from income/expense reports.
  transferId  String?
  /// Set when generated from a RecurringRule.
  recurringRuleId String?
  recurringRule   RecurringRule? @relation(fields: [recurringRuleId], references: [id], onDelete: SetNull)
  /// Hash of (account, date, amount, payee) for CSV-import dedupe.
  importHash  String?
  /// Client-generated id from quick log; makes retries and double taps idempotent.
  clientId    String?   @unique
  /// "quick" | "form" | "import" | "recurring" | "adjustment"
  source      String    @default("form")
  metadata    Json      @default("{}")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([accountId, importHash])
  @@index([accountId, date])
  @@index([categoryId, date])
  @@index([transferId])
  @@map("transactions")
}

model Budget {
  id          String   @id @default(uuid())
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  month       DateTime @db.Date   // always the 1st of the month
  amountMinor Int                 // positive limit
  rollover    Boolean  @default(false)

  @@unique([categoryId, month])
  @@map("budgets")
}

model RecurringRule {
  id          String    @id @default(uuid())
  accountId   String
  categoryId  String?
  payee       String?
  amountMinor Int
  /// { type: "monthly", dayOfMonth } | { type: "weekly", dayOfWeek } | { type: "yearly", month, day }
  schedule    Json
  startDate   DateTime  @db.Date
  endDate     DateTime? @db.Date
  /// Last date a transaction was generated for — makes generation idempotent.
  lastGeneratedOn DateTime? @db.Date
  active      Boolean   @default(true)

  transactions Transaction[]

  @@map("recurring_rules")
}

// Sketch: the built model differs. See "Savings goals" below and schema.prisma.
model SavingsGoal {
  id          String    @id @default(uuid())
  name        String
  targetMinor Int
  deadline    DateTime? @db.Date
  accountId   String?
  account     Account?  @relation(fields: [accountId], references: [id], onDelete: SetNull)
  /// Optional link to a habit whose check-ins represent contributions.
  habitId     String?
  achievedAt  DateTime?
  createdAt   DateTime  @default(now())

  @@map("savings_goals")
}

model QuickPreset {
  id          String    @id @default(uuid())
  label       String                // "Flat white"
  emoji       String?
  amountMinor Int?                  // null → preset opens the keypad with category chosen
  categoryId  String
  category    Category  @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  accountId   String?               // null → default account
  account     Account?  @relation(fields: [accountId], references: [id], onDelete: SetNull)
  payee       String?
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())

  @@map("quick_presets")
}
```

## Decisions

- **One `Account` table with nullable, type-specific columns** instead of
  separate `CreditCard`/`Loan` tables or a JSON `details` blob. Typed
  columns can be queried and sorted ("cards due this week", "highest APR
  first"). Which fields each type requires is enforced by a zod
  discriminated union on `type` in the create/update DTOs. See
  [account-setup.md](account-setup.md) for the fields per type.
- **Rates in basis points (`aprBps`)**, so they're integers too, the same
  idea as minor units for money.
- **`isDefault` has exactly one `true`.** Setting a new default clears the
  old one in the same `$transaction`. A partial unique index
  (`CREATE UNIQUE INDEX … WHERE "isDefault"`) enforces it at the database
  level. Prisma can't express that index, so add it by hand in the
  migration SQL.
- **`source`** records how a transaction got in. Quick-log category ranking
  only learns from `source = "quick"` (see
  [quick-log-implementation.md](quick-log-implementation.md)), and reports
  skip `"adjustment"`.
- **Balances are derived, not stored.** Account balance is
  `openingBalanceMinor + SUM(amountMinor)` over transactions on or after
  `openingBalanceDate`. This follows the "derived data" rule in the
  [habit data model](../domain/habit-data-model.md): streaks and points
  aren't stored either. The `(accountId, date)` index keeps it fast at
  personal scale. Add a cached `balanceMinor` only if profiling shows a
  need, and update it in the same `$transaction` as the write.
- **Report totals are the one stored aggregate.** Balances stay derived
  (a few accounts, summed per request), but spending per month and category
  is read from `monthly_totals`, which every transaction write updates in
  the same database transaction. See
  [budgets-and-reports.md](budgets-and-reports.md#monthly-totals-the-aggregate-table).
- **Transfers are two rows with a shared `transferId`.** One row is
  negative on the source account and the other positive on the
  destination. Both are created in one `prisma.$transaction`, and deleting
  one leg deletes both. Reports filter on `transferId: null`, so moving
  money between your own accounts never shows as spending.
- **Category `kind`** separates income categories from expense categories,
  so the UI can offer the right list based on the amount's sign.
- **Splits** are a `TransactionSplit` table, and a split transaction's own
  `categoryId` is null. See [Splits](#splits).
- **`importHash` has a unique index scoped to the account**, so re-importing
  the same CSV is a no-op. See
  [recurring-and-import.md](recurring-and-import.md).
- **`String` for `Category.kind`** instead of an enum keeps it flexible,
  like `schedule` JSON on `Habit`. Validation happens in zod DTOs.

## Splits

- `TransactionSplit(transactionId, categoryId, amountMinor, note, position)`.
  The parts have the transaction's sign, none is zero, and they add up to
  exactly its amount (`splitProblem` in `split.util.ts`). At least two.
- `PUT /transactions/:id/splits` replaces the parts in one database
  transaction and sets `categoryId` to null; `[]` undoes the split, leaving
  it in "To review". Giving a split transaction a category through the
  normal update also undoes it. Its amount can't change while split (the
  parts would stop adding up): the web form undoes, saves, then re-splits.
- **Monthly totals count each part in its own category**
  (`collectDeltas`), and the recount used by `rebuild` does the same in SQL,
  so budgets and reports need no changes. Transfers and adjustments can't
  be split.
- "To review" and "uncategorised" mean no category **and** no splits.
  Filtering by a category also finds split transactions with a part in it.
- CSV export writes one row per part.

## Savings goals

| Field | Notes |
| ----- | ----- |
| `targetMinor`, `currency` | Positive. The currency is the linked account's, else the main currency when the goal was made |
| `deadline` | Optional. Without one there's no "on track" or monthly amount |
| `accountId` | Linked: the account's balance (never below 0) is what's saved, so transfers in count at once. Unlinked: `savedMinor`, changed by `POST /savings-goals/:id/contributions` (never below 0) |
| `startDate`, `startSavedMinor` | The day it was made and what was saved then: "on track" compares saving since then with the time gone |
| `archivedAt` | Archived goals are hidden unless "Show archived" |

Progress is derived on every read (`goalProgress` in `savings-goal.util.ts`):
`requiredPerMonthMinor` is what's left over the months left (at least one,
so the last weeks ask for the rest), `onTrack` means saved ≥ a steady pace
from `startSavedMinor` to the target, and `overdue` is a passed deadline.
Unlinking an account keeps its balance as the goal's own saved amount.
The habit link (`habitId`, [habits-integration.md](habits-integration.md)) is
phase 6 and not built.

## Payee rules

`PayeeRule(pattern, categoryId, sortOrder)`. Patterns and payees are folded
the same way as import dedupe (`foldPayee`: case, accents and punctuation
don't matter). `*` matches anything and the pattern must then match the
whole payee ("TESCO*"); without a `*` it matches anywhere. The first rule
by `sortOrder` wins, regardless of the amount's sign (a refund from Tesco
is still Groceries). Deleting a category deletes its rules.

## Migration

```bash
pnpm --filter api migrate:dev --name add_finance
```

Then seed the default categories. See [backend-module.md](backend-module.md).
