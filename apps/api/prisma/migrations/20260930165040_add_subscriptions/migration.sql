-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('WEEK', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "ChargeOutcome" AS ENUM ('CONFIRMED', 'SKIPPED');

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceKey" TEXT,
    "domain" TEXT,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTH',
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "firstChargeOn" DATE NOT NULL,
    "trialEndsOn" DATE,
    "askFrom" DATE NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "endsOn" DATE,
    "note" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_prices" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_charges" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "dueOn" DATE NOT NULL,
    "outcome" "ChargeOutcome" NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_logos" (
    "domain" TEXT NOT NULL,
    "data" BYTEA,
    "contentType" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_logos_pkey" PRIMARY KEY ("domain")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_prices_subscriptionId_effectiveFrom_key" ON "subscription_prices"("subscriptionId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_charges_transactionId_key" ON "subscription_charges"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_charges_subscriptionId_dueOn_key" ON "subscription_charges"("subscriptionId", "dueOn");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_prices" ADD CONSTRAINT "subscription_prices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_charges" ADD CONSTRAINT "subscription_charges_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
