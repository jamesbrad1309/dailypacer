-- AlterTable
ALTER TABLE "savings_goals" ADD COLUMN     "habitId" TEXT;

-- CreateTable
CREATE TABLE "savings_contributions" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "savings_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "savings_contributions_goalId_date_idx" ON "savings_contributions"("goalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "savings_goals_habitId_key" ON "savings_goals"("habitId");

-- AddForeignKey
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_contributions" ADD CONSTRAINT "savings_contributions_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "savings_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

