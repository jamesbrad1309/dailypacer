-- Avoid habits, time-boxed habits, streak freezes, challenges, routines,
-- rewards and the points ledger.

-- AlterTable
ALTER TABLE "habits" ADD COLUMN     "endDate" DATE,
ADD COLUMN     "polarity" TEXT NOT NULL DEFAULT 'build';

-- CreateTable
CREATE TABLE "streak_freezes" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streak_freezes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_challenges" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "target" INTEGER NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "startTime" TEXT,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_habits" (
    "routineId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "routine_habits_pkey" PRIMARY KEY ("routineId","habitId")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "cost" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_spends" (
    "id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "rewardId" TEXT,
    "freezeId" TEXT,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_spends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "streak_freezes_habitId_date_key" ON "streak_freezes"("habitId", "date");

-- CreateIndex
CREATE INDEX "habit_challenges_habitId_idx" ON "habit_challenges"("habitId");

-- CreateIndex
CREATE UNIQUE INDEX "routine_habits_habitId_key" ON "routine_habits"("habitId");

-- CreateIndex
CREATE UNIQUE INDEX "points_spends_freezeId_key" ON "points_spends"("freezeId");

-- AddForeignKey
ALTER TABLE "streak_freezes" ADD CONSTRAINT "streak_freezes_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_challenges" ADD CONSTRAINT "habit_challenges_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_habits" ADD CONSTRAINT "routine_habits_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_habits" ADD CONSTRAINT "routine_habits_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_spends" ADD CONSTRAINT "points_spends_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_spends" ADD CONSTRAINT "points_spends_freezeId_fkey" FOREIGN KEY ("freezeId") REFERENCES "streak_freezes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A habit is built or avoided; points are spent in positive amounts.
ALTER TABLE "habits" ADD CONSTRAINT "habits_polarity_check" CHECK ("polarity" IN ('build', 'avoid'));
ALTER TABLE "points_spends" ADD CONSTRAINT "points_spends_points_positive" CHECK ("points" > 0);
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_cost_positive" CHECK ("cost" > 0);
ALTER TABLE "habit_challenges" ADD CONSTRAINT "habit_challenges_range_check"
  CHECK ("endDate" >= "startDate" AND "target" > 0 AND "multiplier" >= 1);
