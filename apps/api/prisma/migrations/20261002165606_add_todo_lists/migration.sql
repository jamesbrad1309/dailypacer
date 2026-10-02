-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "todo_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "isInbox" BOOLEAN NOT NULL DEFAULT false,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todo_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedFor" DATE,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "todo_lists_prefix_key" ON "todo_lists"("prefix");

-- CreateIndex
CREATE INDEX "tasks_plannedFor_idx" ON "tasks"("plannedFor");

-- CreateIndex
CREATE INDEX "tasks_listId_status_position_idx" ON "tasks"("listId", "status", "position");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_listId_number_key" ON "tasks"("listId", "number");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_listId_fkey" FOREIGN KEY ("listId") REFERENCES "todo_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every task belongs to a list; this one catches tasks added without one.
INSERT INTO "todo_lists" ("id", "name", "prefix", "isInbox", "updatedAt")
VALUES (gen_random_uuid()::text, 'Inbox', 'TASK', true, CURRENT_TIMESTAMP);
