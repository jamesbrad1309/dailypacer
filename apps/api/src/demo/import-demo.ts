import { readFileSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { PrismaService } from "#common/database/prisma.service";
import { DEMO_VERSION, type DemoFixture, dayAt, localToday, monthAt } from "#demo/demo-fixture";
import { AccountsService } from "#finance/accounts.service";
import { BudgetsService } from "#finance/budgets.service";
import { CategoriesService } from "#finance/categories.service";
import { createAccountSchema } from "#finance/dto/account.dto";
import { createTransactionSchema, createTransferSchema } from "#finance/dto/transaction.dto";
import { FinanceHabitsService } from "#finance/finance-habits.service";
import { FINANCE_HABIT_SOURCES, LOGGED_TODAY, NO_SPEND } from "#finance/finance-habits.util";
import { SavingsGoalsService } from "#finance/savings-goals.service";
import { shareProblem } from "#finance/split-with.util";
import { TransactionsService } from "#finance/transactions.service";
import { HabitEntriesService } from "#habit-entries/habit-entries.service";
import { createHabitSchema } from "#habits/dto/create-habit.dto";
import { HabitsService } from "#habits/habits.service";
import { createJournalEntriesSchema } from "#journal/dto/journal-entry.dto";
import { JournalService } from "#journal/journal.service";
import { createTaskSchema } from "#todos/dto/todo.dto";
import { TodosService } from "#todos/todos.service";
import { AppModule } from "../app.module";

/**
 * `demo:import [file] [--today=YYYY-MM-DD]`: loads a demo fixture
 * (demo-fixture.ts) into an empty database, every day offset counted from
 * `today` (the local day by default). It goes through the app's services,
 * so balances, monthly totals and finance-ticked habits come out exactly as
 * if it had all been typed in; then it backdates what services stamp with
 * "now" (habit and task creation, task completion) so streaks and history
 * read right.
 */
async function main() {
  const args = process.argv.slice(2);
  const today = args.find((a) => a.startsWith("--today="))?.slice(8) ?? localToday();
  const file = args.find((a) => !a.startsWith("--")) ?? "demo/dailypacer-demo.json";
  const fixture = JSON.parse(readFileSync(file, "utf8")) as DemoFixture;
  if (fixture.version !== DEMO_VERSION) {
    throw new Error(`${file} is version ${fixture.version}; this importer reads ${DEMO_VERSION}`);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  try {
    await importFixture(app, fixture, today);
    console.log(`Imported ${file}, with day 0 = ${today}`);
  } finally {
    await app.close();
  }
}

type App = Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;

async function importFixture(app: App, fixture: DemoFixture, today: string) {
  const prisma = app.get(PrismaService);
  const day = (offset: number) => dayAt(today, offset);
  /** A creation instant on that day: midday UTC is the same calendar day almost everywhere. */
  const instant = (offset: number) => new Date(`${day(offset)}T12:00:00.000Z`);

  await assertEmpty(prisma);

  // ── Categories: seeded ones by key, the user's own by name ──
  const categoriesService = app.get(CategoriesService);
  for (const c of fixture.categories) {
    const parentId = c.parent ? (await categoryIds(prisma)).get(c.parent.toLowerCase()) : null;
    await categoriesService.create({ name: c.name, kind: c.kind, icon: c.icon ?? null, parentId });
  }
  const categories = await categoryIds(prisma);
  const category = (ref: string | null | undefined) => {
    if (!ref) return null;
    const id = categories.get(ref.toLowerCase());
    if (!id) throw new Error(`Unknown category "${ref}"`);
    return id;
  };

  // ── Accounts ──
  const accountsService = app.get(AccountsService);
  const accounts = new Map<string, string>();
  for (const { ref, openedDay, loanStartDay, archived: _a, ...a } of fixture.accounts) {
    const input = createAccountSchema.parse({
      ...a,
      openingBalanceDate: day(openedDay),
      ...(a.type === "LOAN" && { loanStartDate: loanStartDay != null ? day(loanStartDay) : null }),
    });
    accounts.set(ref, (await accountsService.create(input)).id);
  }
  const account = (ref: string) => {
    const id = accounts.get(ref);
    if (!id) throw new Error(`Unknown account "${ref}"`);
    return id;
  };

  // ── Budgets, oldest first: a rule carries forward until the next ──
  const budgets = app.get(BudgetsService);
  for (const b of [...fixture.budgets].sort((x, y) => x.month - y.month)) {
    const categoryId = category(b.category) as string;
    const month = monthAt(today, b.month);
    if (b.amountMinor === null) await budgets.remove(categoryId, month);
    else
      await budgets.set({
        categoryId,
        month,
        amountMinor: b.amountMinor,
        rollover: b.rollover ?? false,
      });
  }

  // ── Transactions and transfers ──
  const transactions = app.get(TransactionsService);
  for (const t of fixture.transactions) {
    const input = createTransactionSchema.parse({
      accountId: account(t.account),
      categoryId: t.splits?.length ? null : category(t.category),
      date: day(t.day),
      amountMinor: t.amountMinor,
      payee: t.payee ?? null,
      note: t.note ?? null,
      tags: t.tags ?? [],
      status: t.status ?? "CLEARED",
    });
    // A shared bill comes back linked, the same way quick log's "Split with…" makes it.
    const shares = (t.shares ?? []).map((s) => ({
      accountId: account(s.account),
      amountMinor: s.amountMinor,
    }));
    const problem = shares.length > 0 ? shareProblem(-t.amountMinor, shares) : null;
    if (problem) throw new Error(`Shared bill on day ${t.day}: ${problem}`);
    const created =
      shares.length > 0
        ? await transactions.createSharedExpense(input, shares, t.source ?? "form")
        : await transactions.create(input, t.source ?? "form");
    if (t.splits?.length) {
      await transactions.setSplits(created.id, {
        splits: t.splits.map((s) => ({
          categoryId: category(s.category) as string,
          amountMinor: s.amountMinor,
          note: s.note ?? null,
        })),
      });
    }
  }
  for (const t of fixture.transfers) {
    await transactions.createTransfer(
      createTransferSchema.parse({
        fromAccountId: account(t.from),
        toAccountId: account(t.to),
        date: day(t.day),
        amountMinor: t.amountMinor,
        toAmountMinor: t.toAmountMinor,
        note: t.note ?? undefined,
      }),
    );
  }

  // ── Savings goals: their daily habits are made by the goals ──
  const goals = app.get(SavingsGoalsService);
  for (const g of fixture.goals) {
    const goal = await goals.create({
      name: g.name,
      emoji: g.emoji ?? null,
      targetMinor: g.targetMinor,
      deadline: g.deadlineDay != null ? day(g.deadlineDay) : null,
      accountId: g.account ? account(g.account) : null,
      ...(!g.account && { savedMinor: g.startingSavedMinor ?? 0 }),
      ...(g.dailyHabitMinor && { dailyHabitMinor: g.dailyHabitMinor }),
      today: day(g.createdDay),
    });
    if (goal.habitId) {
      await prisma.habit.update({
        where: { id: goal.habitId },
        data: { createdAt: instant(g.createdDay) },
      });
    }
    for (const c of g.contributions) {
      await goals.contribute(goal.id, { amountMinor: c.amountMinor, today: day(c.day) });
    }
    if (g.archived) await goals.update(goal.id, { archived: true, today });
  }

  // ── Habits ──
  const habits = app.get(HabitsService);
  const entries = app.get(HabitEntriesService);
  for (const h of fixture.habits) {
    const source =
      h.finance === "NO_SPEND" ? NO_SPEND : h.finance === "LOGGED_TODAY" ? LOGGED_TODAY : null;
    const categoryIdsForHabit = (h.categories ?? []).map((ref) => category(ref) as string);
    const habit = await habits.create(
      createHabitSchema.parse({
        name: h.name,
        description: h.description ?? undefined,
        tags: h.tags ?? [],
        icon: h.icon ?? undefined,
        unit: h.unit ?? undefined,
        targetValue: h.targetValue ?? undefined,
        startTime: h.startTime ?? undefined,
        schedule: h.schedule,
        polarity: h.finance === "NO_SPEND" ? "avoid" : (h.polarity ?? "build"),
        endDate: h.endDay != null ? day(h.endDay) : undefined,
        customFields: h.customFields?.length ? h.customFields : undefined,
        metadata: {
          ...(source && { source }),
          ...(categoryIdsForHabit.length > 0 && { categoryIds: categoryIdsForHabit }),
        },
      }),
    );
    await prisma.habit.update({
      where: { id: habit.id },
      data: { createdAt: instant(h.createdDay) },
    });
    for (const e of h.entries) {
      await entries.upsert({
        habitId: habit.id,
        date: day(e.day),
        completed: e.completed ?? false,
        value: e.value ?? undefined,
        note: e.note ?? undefined,
      });
    }
    if (h.pausedDay != null) await habits.pause(habit.id, day(h.pausedDay));
    if (h.archived) await habits.archive(habit.id);
  }

  // Every finance-ticked habit, worked out again now its creation day is backdated.
  const financeHabits = app.get(FinanceHabitsService);
  const linked = await prisma.habit.findMany({
    where: {
      archivedAt: null,
      OR: FINANCE_HABIT_SOURCES.map((s) => ({ metadata: { path: ["source"], equals: s } })),
    },
    select: { id: true },
  });
  for (const { id } of linked) await financeHabits.recompute(id);

  // ── Journal, a day at a time: triggers point within the day ──
  const journal = app.get(JournalService);
  for (const d of fixture.journal) {
    await journal.createMany(
      createJournalEntriesSchema.parse(
        d.entries.map((e) => ({
          kind: e.kind,
          date: day(d.day),
          time: e.time ?? null,
          text: e.text,
          ...(e.kind === "ACTION" && { durationMinutes: e.durationMinutes ?? null }),
          ...(e.kind === "FEELING" && { emotion: e.emotion, intensity: e.intensity ?? 3 }),
          ...(e.kind === "EVENT" && { tone: e.tone ?? null }),
          triggerIndex: e.triggerIndex ?? null,
        })),
      ),
    );
  }

  // ── To-do lists ──
  const todos = app.get(TodosService);
  const inbox = await prisma.todoList.findFirst({ where: { isInbox: true } });
  for (const list of fixture.todoLists) {
    const listId =
      list.name === "Inbox" && inbox
        ? inbox.id
        : (await todos.createList({ name: list.name, prefix: list.prefix })).id;
    for (const t of list.tasks) {
      const task = await todos.createTask(
        createTaskSchema.parse({
          title: t.title,
          notes: t.notes ?? null,
          listId,
          status: t.status,
          plannedFor: t.plannedDay != null ? day(t.plannedDay) : null,
          dueOn: t.dueDay != null ? day(t.dueDay) : null,
        }),
      );
      await prisma.task.update({
        where: { id: task.id },
        data: {
          createdAt: instant(t.createdDay),
          ...(t.status === "DONE" && { completedAt: instant(t.doneDay ?? t.createdDay) }),
        },
      });
    }
  }

  // Archived last, so they could take transactions and goals first.
  for (const a of fixture.accounts) {
    if (a.archived) await accountsService.archive(account(a.ref));
  }
}

/** Lowercased seeded keys and names → ids. */
async function categoryIds(prisma: PrismaService): Promise<Map<string, string>> {
  const rows = await prisma.category.findMany({ where: { archivedAt: null } });
  const map = new Map<string, string>();
  for (const c of rows) map.set(c.name.toLowerCase(), c.id);
  for (const c of rows) {
    const key = (c.metadata as { key?: string }).key;
    if (key) map.set(key.toLowerCase(), c.id);
  }
  return map;
}

/** An import adds to nothing: mixing demo data with real data can't be undone cleanly. */
async function assertEmpty(prisma: PrismaService) {
  const counts = {
    accounts: await prisma.account.count(),
    habits: await prisma.habit.count(),
    "savings goals": await prisma.savingsGoal.count(),
    "journal entries": await prisma.journalEntry.count(),
    tasks: await prisma.task.count(),
  };
  const found = Object.entries(counts).filter(([, n]) => n > 0);
  if (found.length > 0) {
    throw new Error(
      `demo:import needs an empty database; found ${found.map(([what, n]) => `${n} ${what}`).join(", ")}. Start from a fresh one (docker compose down -v, then up) and run it again.`,
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
