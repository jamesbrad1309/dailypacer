-- Per-user data (docs/admin/multi-user-plan.md, phases 2 and 3): every
-- top-level table gets an owner. Rows below them (habit entries, splits,
-- board columns…) belong to their parent's owner. The app always sets
-- "userId" on insert; its default reads a setting that's never set, so an
-- insert that forgets fails instead of creating a row nobody owns.

-- Someone to own what's already here: the oldest owner, active first. A
-- database without one gets an "unclaimed" owner that can't sign in; the
-- first sign-up, or OWNER_EMAIL on start, claims it with its data
-- (src/auth/auth.service.ts).
INSERT INTO "users" ("id", "email", "name", "passwordHash", "role", "status", "updatedAt")
SELECT gen_random_uuid()::text, 'owner@unclaimed.invalid', 'Owner', 'unclaimed', 'OWNER', 'PENDING', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "users" WHERE "role" = 'OWNER');

CREATE TEMP TABLE "_data_owner" AS
SELECT "id" FROM "users" WHERE "role" = 'OWNER'
ORDER BY ("status" = 'ACTIVE') DESC, "createdAt" ASC
LIMIT 1;

-- habits
ALTER TABLE "habits" ADD COLUMN "userId" TEXT;
UPDATE "habits" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "habits" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "habits" ADD CONSTRAINT "habits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "habits_userId_idx" ON "habits"("userId");

-- routines
ALTER TABLE "routines" ADD COLUMN "userId" TEXT;
UPDATE "routines" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "routines" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "routines" ADD CONSTRAINT "routines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "routines_userId_idx" ON "routines"("userId");

-- rewards
ALTER TABLE "rewards" ADD COLUMN "userId" TEXT;
UPDATE "rewards" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "rewards" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "rewards_userId_idx" ON "rewards"("userId");

-- points_spends
ALTER TABLE "points_spends" ADD COLUMN "userId" TEXT;
UPDATE "points_spends" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "points_spends" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "points_spends" ADD CONSTRAINT "points_spends_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "points_spends_userId_idx" ON "points_spends"("userId");

-- journal_entries
ALTER TABLE "journal_entries" ADD COLUMN "userId" TEXT;
UPDATE "journal_entries" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "journal_entries" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "journal_entries_userId_idx" ON "journal_entries"("userId");

-- accounts
ALTER TABLE "accounts" ADD COLUMN "userId" TEXT;
UPDATE "accounts" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "accounts" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- categories
ALTER TABLE "categories" ADD COLUMN "userId" TEXT;
UPDATE "categories" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "categories" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "categories" ADD CONSTRAINT "categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "categories_userId_idx" ON "categories"("userId");

-- transactions
ALTER TABLE "transactions" ADD COLUMN "userId" TEXT;
UPDATE "transactions" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "transactions" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");

-- quick_presets
ALTER TABLE "quick_presets" ADD COLUMN "userId" TEXT;
UPDATE "quick_presets" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "quick_presets" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "quick_presets" ADD CONSTRAINT "quick_presets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "quick_presets_userId_idx" ON "quick_presets"("userId");

-- budgets
ALTER TABLE "budgets" ADD COLUMN "userId" TEXT;
UPDATE "budgets" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "budgets" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "budgets_userId_idx" ON "budgets"("userId");

-- currencies
ALTER TABLE "currencies" ADD COLUMN "userId" TEXT;
UPDATE "currencies" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "currencies" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "currencies_userId_idx" ON "currencies"("userId");

-- subscriptions
ALTER TABLE "subscriptions" ADD COLUMN "userId" TEXT;
UPDATE "subscriptions" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "subscriptions" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- todo_lists
ALTER TABLE "todo_lists" ADD COLUMN "userId" TEXT;
UPDATE "todo_lists" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "todo_lists" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "todo_lists" ADD CONSTRAINT "todo_lists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "todo_lists_userId_idx" ON "todo_lists"("userId");

-- tasks
ALTER TABLE "tasks" ADD COLUMN "userId" TEXT;
UPDATE "tasks" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "tasks" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "tasks_userId_idx" ON "tasks"("userId");

-- savings_goals
ALTER TABLE "savings_goals" ADD COLUMN "userId" TEXT;
UPDATE "savings_goals" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "savings_goals" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "savings_goals_userId_idx" ON "savings_goals"("userId");

-- payee_rules
ALTER TABLE "payee_rules" ADD COLUMN "userId" TEXT;
UPDATE "payee_rules" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "payee_rules" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "payee_rules" ADD CONSTRAINT "payee_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "payee_rules_userId_idx" ON "payee_rules"("userId");

-- notifications
ALTER TABLE "notifications" ADD COLUMN "userId" TEXT;
UPDATE "notifications" SET "userId" = (SELECT "id" FROM "_data_owner");
ALTER TABLE "notifications" ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "userId" SET DEFAULT current_setting('app.user_id'::text);
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

DROP TABLE "_data_owner";

-- Keys that were global are now per user.
ALTER TABLE "currencies" DROP CONSTRAINT "currencies_pkey",
ADD CONSTRAINT "currencies_pkey" PRIMARY KEY ("userId", "code");

DROP INDEX "todo_lists_prefix_key";
CREATE UNIQUE INDEX "todo_lists_userId_prefix_key" ON "todo_lists"("userId", "prefix");

DROP INDEX "transactions_clientId_key";
CREATE UNIQUE INDEX "transactions_userId_clientId_key" ON "transactions"("userId", "clientId");

DROP INDEX "notifications_key_key";
CREATE UNIQUE INDEX "notifications_userId_key_key" ON "notifications"("userId", "key");

-- Hand-written partial indexes Prisma can't express: one default account,
-- one main currency and unique top-level category names, each per user.
DROP INDEX "accounts_single_default";
CREATE UNIQUE INDEX "accounts_single_default" ON "accounts" ("userId") WHERE "isDefault";

DROP INDEX "currencies_single_main";
CREATE UNIQUE INDEX "currencies_single_main" ON "currencies" ("userId") WHERE "isMain";

DROP INDEX "categories_top_level_name_key";
CREATE UNIQUE INDEX "categories_top_level_name_key" ON "categories" ("userId", "name") WHERE "parentId" IS NULL;
