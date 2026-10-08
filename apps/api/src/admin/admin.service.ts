import { Injectable } from "@nestjs/common";
import { PrismaService } from "#common/database/prisma.service";

/** One table's row count, grouped by product area for the admin overview. */
export interface TableCount {
  area: "habits" | "journal" | "finance" | "tasks";
  table: string;
  rows: number;
}

export interface AdminOverview {
  tables: TableCount[];
  database: { migrations: number; latestMigration: string | null; latestAppliedAt: string | null };
  server: { nodeVersion: string; uptimeSeconds: number; startedAt: string };
}

const startedAt = new Date();

/**
 * Read-only facts for the admin dashboard (apps/admin). There's no sign-in
 * yet, like the rest of the API; see docs/admin/use-cases.md.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<AdminOverview> {
    const db = this.prisma;
    const counts: [TableCount["area"], string, Promise<number>][] = [
      ["habits", "Habit", db.habit.count()],
      ["habits", "HabitEntry", db.habitEntry.count()],
      ["habits", "Routine", db.routine.count()],
      ["habits", "Reward", db.reward.count()],
      ["habits", "HabitChallenge", db.habitChallenge.count()],
      ["journal", "JournalEntry", db.journalEntry.count()],
      ["finance", "Account", db.account.count()],
      ["finance", "Category", db.category.count()],
      ["finance", "Transaction", db.transaction.count()],
      ["finance", "Budget", db.budget.count()],
      ["finance", "Subscription", db.subscription.count()],
      ["finance", "SavingsGoal", db.savingsGoal.count()],
      ["finance", "PayeeRule", db.payeeRule.count()],
      ["finance", "Currency", db.currency.count()],
      ["tasks", "TodoList", db.todoList.count()],
      ["tasks", "Task", db.task.count()],
    ];
    const rows = await Promise.all(counts.map(([, , count]) => count));
    const [migrations] = await db.$queryRaw<
      { count: bigint; latest: string | null; applied: Date | null }[]
    >`SELECT count(*) AS count,
             (array_agg(migration_name ORDER BY migration_name DESC))[1] AS latest,
             max(finished_at) AS applied
        FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`;
    return {
      tables: counts.map(([area, table], i) => ({ area, table, rows: rows[i] })),
      database: {
        migrations: Number(migrations.count),
        latestMigration: migrations.latest,
        latestAppliedAt: migrations.applied?.toISOString() ?? null,
      },
      server: {
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        startedAt: startedAt.toISOString(),
      },
    };
  }
}
