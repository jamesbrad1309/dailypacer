-- Prisma can't express CHECK constraints.
ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_interval_count" CHECK ("intervalCount" BETWEEN 1 AND 52);


ALTER TABLE "subscription_prices"
  ADD CONSTRAINT "subscription_prices_positive_amount" CHECK ("amountMinor" > 0);

-- A skipped charge has no transaction; a confirmed one starts with one (and
-- is deleted along with it).
ALTER TABLE "subscription_charges"
  ADD CONSTRAINT "subscription_charges_outcome_transaction"
  CHECK (("outcome" = 'CONFIRMED') = ("transactionId" IS NOT NULL));
