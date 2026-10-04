-- Custom board columns, due dates, and an order within the planned day.

-- CreateTable
CREATE TABLE "todo_columns" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "name" TEXT,
    "status" "TaskStatus" NOT NULL,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "todo_columns_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "columnId" TEXT,
ADD COLUMN "dayPosition" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "dueOn" DATE;

-- Every existing list gets the three columns it had before, unnamed so
-- they show in the UI language, and each task goes to its status's column.
INSERT INTO "todo_columns" ("id", "listId", "status", "position")
SELECT gen_random_uuid()::text, l."id", s."status"::"TaskStatus", s."position"
FROM "todo_lists" l
CROSS JOIN (VALUES ('TODO', 1), ('IN_PROGRESS', 2), ('DONE', 3)) AS s("status", "position");

UPDATE "tasks" t SET "columnId" = c."id"
FROM "todo_columns" c
WHERE c."listId" = t."listId" AND c."status" = t."status";

ALTER TABLE "tasks" ALTER COLUMN "columnId" SET NOT NULL;

-- Today's existing order (by creation) becomes the starting day order.
UPDATE "tasks" t SET "dayPosition" = r.n
FROM (
    SELECT "id", row_number() OVER (PARTITION BY "plannedFor" ORDER BY "createdAt") AS n
    FROM "tasks" WHERE "plannedFor" IS NOT NULL
) r
WHERE r."id" = t."id";

-- CreateIndex
CREATE INDEX "todo_columns_listId_position_idx" ON "todo_columns"("listId", "position");

-- CreateIndex
CREATE INDEX "tasks_columnId_position_idx" ON "tasks"("columnId", "position");

-- CreateIndex
CREATE INDEX "tasks_dueOn_idx" ON "tasks"("dueOn");

-- AddForeignKey
ALTER TABLE "todo_columns" ADD CONSTRAINT "todo_columns_listId_fkey" FOREIGN KEY ("listId") REFERENCES "todo_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "todo_columns"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
