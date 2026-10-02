-- CreateTable
CREATE TABLE "habit_pauses" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "habit_pauses_habitId_idx" ON "habit_pauses"("habitId");

-- AddForeignKey
ALTER TABLE "habit_pauses" ADD CONSTRAINT "habit_pauses_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: a habit paused before pause history existed gets an open pause
-- from the day it was paused.
INSERT INTO "habit_pauses" ("id", "habitId", "startDate")
SELECT gen_random_uuid()::text, "id", "pausedAt"::date
FROM "habits"
WHERE "pausedAt" IS NOT NULL;
