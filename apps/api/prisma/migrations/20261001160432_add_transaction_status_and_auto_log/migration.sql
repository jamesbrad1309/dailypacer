-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('CLEARED', 'PENDING');

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "autoLog" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoLoggedThrough" DATE,
ADD COLUMN     "isIncome" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'CLEARED';

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");
