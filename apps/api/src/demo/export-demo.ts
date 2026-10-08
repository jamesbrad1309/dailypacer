import { writeFileSync } from "node:fs";
import type { Account, PrismaClient } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import {
  DEMO_VERSION,
  type DemoAccount,
  type DemoFixture,
  type DemoJournalDay,
  localToday,
  monthOffsetOf,
  offsetOf,
} from "#demo/demo-fixture";
import { toIsoDate } from "#finance/calendar.util";
import { LOGGED_TODAY, NO_SPEND, SAVINGS_GOAL } from "#finance/finance-habits.util";

/**
 * `demo:export [file] [--today=YYYY-MM-DD]`: the database as a demo fixture
 * (demo-fixture.ts), every date an offset from `today`. Only what
 * `demo:import` can rebuild is written; anything else is counted on stderr.
 */
async function main() {
  const args = process.argv.slice(2);
  const today = args.find((a) => a.startsWith("--today="))?.slice(8) ?? localToday();
  const file = args.find((a) => !a.startsWith("--"));
  const prisma = new PrismaService();
  try {
    const fixture = await exportFixture(prisma, today);
    const json = `${JSON.stringify(fixture, null, 2)}\n`;
    if (file) {
      writeFileSync(file, json);
      console.error(`Exported to ${file} (dates relative to ${today})`);
    } else {
      process.stdout.write(json);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const day = (today: string, date: Date) => offsetOf(today, toIsoDate(date));
const dayOrNull = (today: string, date: Date | null) => (date ? day(today, date) : null);

async function exportFixture(prisma: PrismaClient, today: string): Promise<DemoFixture> {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  const keyOf = (c: { metadata: unknown }) => (c.metadata as { key?: string }).key;
  const catRef = new Map(categories.map((c) => [c.id, keyOf(c) ?? c.name]));
  const ref = (id: string | null) => (id ? (catRef.get(id) ?? null) : null);

  const accounts = await prisma.account.findMany({ orderBy: { sortOrder: "asc" } });
  const accountRef = new Map<string, string>();
  for (const a of accounts) {
    let slug =
      a.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "account";
    while ([...accountRef.values()].includes(slug)) slug += "-2";
    accountRef.set(a.id, slug);
  }
  const acc = (id: string) => accountRef.get(id) ?? id;

  const [transactions, habits, goals, journal, lists, budgets] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: { splits: { orderBy: { position: "asc" } } },
    }),
    prisma.habit.findMany({
      orderBy: { createdAt: "asc" },
      include: { entries: { orderBy: { date: "asc" } }, pauses: true },
    }),
    prisma.savingsGoal.findMany({
      orderBy: { sortOrder: "asc" },
      include: { contributions: { orderBy: { date: "asc" } }, habit: true },
    }),
    prisma.journalEntry.findMany({ orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.todoList.findMany({
      orderBy: { position: "asc" },
      include: { tasks: { orderBy: { number: "asc" } } },
    }),
    prisma.budget.findMany({ orderBy: { month: "asc" } }),
  ]);

  const skipped: Record<string, number> = {
    "balance adjustments": transactions.filter((t) => t.source === "adjustment").length,
    "subscription charges": transactions.filter((t) => t.source === "recurring").length,
    subscriptions: await prisma.subscription.count(),
    "streak freezes": await prisma.streakFreeze.count(),
    challenges: await prisma.habitChallenge.count(),
    routines: await prisma.routine.count(),
    rewards: await prisma.reward.count(),
    "payee rules": await prisma.payeeRule.count(),
    "quick-log presets": await prisma.quickPreset.count(),
    "task dependencies": await prisma.taskDependency.count(),
  };

  const legs = new Map<string, typeof transactions>();
  for (const t of transactions) {
    if (t.transferId) legs.set(t.transferId, [...(legs.get(t.transferId) ?? []), t]);
  }

  const fixture: DemoFixture = {
    version: DEMO_VERSION,
    exportedOn: today,
    categories: categories
      .filter((c) => !c.isSystem && !keyOf(c))
      .map((c) => ({
        name: c.name,
        kind: c.kind as "expense" | "income",
        icon: c.icon,
        parent: ref(c.parentId),
      })),
    accounts: accounts.map((a) => demoAccount(a, accountRef.get(a.id) ?? a.id, today)),
    budgets: budgets.map((b) => ({
      category: ref(b.categoryId) ?? b.categoryId,
      month: monthOffsetOf(today, toIsoDate(b.month).slice(0, 7)),
      amountMinor: b.amountMinor,
      rollover: b.rollover,
    })),
    transactions: transactions
      .filter((t) => !t.transferId && t.source !== "adjustment" && t.source !== "recurring")
      .map((t) => ({
        account: acc(t.accountId),
        day: day(today, t.date),
        ...sharedBill(t, acc),
        category: ref(t.categoryId),
        payee: t.payee,
        note: t.note,
        tags: t.tags,
        source: (["quick", "import"].includes(t.source) ? t.source : "form") as
          | "form"
          | "quick"
          | "import",
        status: t.status,
        ...(t.splits.length > 0 && {
          splits: t.splits.map((s) => ({
            category: ref(s.categoryId) ?? s.categoryId,
            amountMinor: s.amountMinor,
            note: s.note,
          })),
        }),
      })),
    // A shared bill's transfers come back with the bill (its `shares`).
    transfers: [...legs.values()].flatMap((pair) => {
      if ((pair[0].metadata as { splitGroupId?: string }).splitGroupId) return [];
      const out = pair.find((t) => t.amountMinor < 0);
      const into = pair.find((t) => t.amountMinor > 0);
      if (!out || !into) return [];
      return [
        {
          from: acc(out.accountId),
          to: acc(into.accountId),
          day: day(today, out.date),
          amountMinor: -out.amountMinor,
          ...(into.amountMinor !== -out.amountMinor && { toAmountMinor: into.amountMinor }),
          note: out.note,
        },
      ];
    }),
    habits: habits
      // A goal's daily habit comes back with its goal.
      .filter((h) => (h.metadata as { source?: string }).source !== SAVINGS_GOAL)
      .map((h) => {
        const meta = h.metadata as {
          source?: string;
          categoryIds?: string[];
          fields?: { label: string; value: string }[];
        };
        const finance =
          meta.source === NO_SPEND
            ? "NO_SPEND"
            : meta.source === LOGGED_TODAY
              ? "LOGGED_TODAY"
              : null;
        const openPause = h.pauses.find((p) => p.endDate === null);
        return {
          name: h.name,
          createdDay: day(today, h.createdAt),
          description: h.description,
          tags: h.tags,
          icon: h.icon,
          color: h.color,
          unit: h.unit,
          targetValue: h.targetValue,
          startTime: h.startTime,
          schedule: h.schedule,
          polarity: h.polarity as "build" | "avoid",
          endDay: dayOrNull(today, h.endDate),
          customFields: meta.fields ?? [],
          finance,
          categories: (meta.categoryIds ?? []).map((id) => ref(id) ?? id),
          pausedDay: openPause ? day(today, openPause.startDate) : null,
          archived: h.archivedAt !== null,
          // A finance habit's entries are re-derived from the transactions on import.
          entries: finance
            ? []
            : h.entries.map((e) => ({
                day: day(today, e.date),
                completed: e.completed,
                value: e.value,
                note: e.note,
              })),
        };
      }),
    goals: goals.map((g) => {
      const contributed = g.contributions.reduce((sum, c) => sum + c.amountMinor, 0);
      const habitActive = g.habit && !g.habit.archivedAt && g.habit.targetValue !== null;
      const digits =
        new Intl.NumberFormat("en", { style: "currency", currency: g.currency }).resolvedOptions()
          .maximumFractionDigits ?? 2;
      return {
        name: g.name,
        emoji: g.emoji,
        targetMinor: g.targetMinor,
        createdDay: day(today, g.startDate),
        deadlineDay: dayOrNull(today, g.deadline),
        account: g.accountId ? acc(g.accountId) : null,
        ...(!g.accountId && { startingSavedMinor: g.savedMinor - contributed }),
        dailyHabitMinor: habitActive
          ? Math.round((g.habit?.targetValue ?? 0) * 10 ** digits)
          : null,
        archived: g.archivedAt !== null,
        contributions: g.contributions.map((c) => ({
          day: day(today, c.date),
          amountMinor: c.amountMinor,
        })),
      };
    }),
    journal: journalDays(journal, today),
    todoLists: lists.map((list) => ({
      name: list.isInbox ? "Inbox" : list.name,
      ...(!list.isInbox && { prefix: list.prefix }),
      tasks: list.tasks.map((t) => ({
        title: t.title,
        notes: t.notes,
        status: t.status,
        createdDay: day(today, t.createdAt),
        plannedDay: dayOrNull(today, t.plannedFor),
        dueDay: dayOrNull(today, t.dueOn),
        doneDay: dayOrNull(today, t.completedAt),
      })),
    })),
  };

  for (const [what, count] of Object.entries(skipped)) {
    if (count > 0)
      console.error(`Not exported (demo:import can't rebuild them yet): ${count} ${what}`);
  }
  return fixture;
}

/**
 * A shared bill ("Split with…") is written whole, with who owes what, so the
 * import rebuilds it linked; any other transaction just keeps its amount.
 */
function sharedBill(
  t: { amountMinor: number; metadata: unknown },
  acc: (id: string) => string,
): { amountMinor: number; shares?: { account: string; amountMinor: number }[] } {
  const { sharedTotalMinor, sharedWith } = t.metadata as {
    sharedTotalMinor?: number;
    sharedWith?: { accountId: string; amountMinor: number }[];
  };
  if (!sharedTotalMinor || !sharedWith?.length) return { amountMinor: t.amountMinor };
  return {
    amountMinor: -sharedTotalMinor,
    shares: sharedWith.map((s) => ({ account: acc(s.accountId), amountMinor: s.amountMinor })),
  };
}

/** The create input as the user typed it: owed amounts positive (storedBalance in reverse). */
function demoAccount(a: Account, ref: string, today: string): DemoAccount {
  const owed = a.type === "CREDIT_CARD" || a.type === "LOAN";
  return {
    ref,
    name: a.name,
    type: a.type,
    currency: a.currency,
    institution: a.institution,
    last4: a.last4,
    icon: a.icon,
    color: a.color,
    currentBalanceMinor:
      owed || a.type === "IOU" ? Math.abs(a.openingBalanceMinor) : a.openingBalanceMinor,
    openedDay: day(today, a.openingBalanceDate),
    ...(a.type === "IOU" && { owedByMe: a.openingBalanceMinor < 0 }),
    ...(a.type === "CREDIT_CARD" && {
      creditLimitMinor: a.creditLimitMinor ?? 0,
      statementDay: a.statementDay,
      paymentDueDay: a.paymentDueDay,
      minPaymentMinor: a.minPaymentMinor,
      aprBps: a.aprBps,
    }),
    ...(a.type === "LOAN" && {
      aprBps: a.aprBps,
      monthlyPaymentMinor: a.monthlyPaymentMinor,
      loanStartDay: dayOrNull(today, a.loanStartDate),
      termMonths: a.termMonths,
    }),
    archived: a.archivedAt !== null,
  };
}

/** Entries per day; a trigger on the same day becomes a position in that day's list. */
function journalDays(
  entries: Awaited<ReturnType<PrismaClient["journalEntry"]["findMany"]>>,
  today: string,
): DemoJournalDay[] {
  const days = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = toIsoDate(e.date);
    days.set(key, [...(days.get(key) ?? []), e]);
  }
  return [...days.entries()].map(([date, list]) => ({
    day: offsetOf(today, date),
    entries: list.map((e) => {
      const trigger = e.triggerId ? list.findIndex((t) => t.id === e.triggerId) : -1;
      return {
        kind: e.kind,
        time: e.time,
        text: e.text,
        durationMinutes: e.durationMinutes,
        emotion: e.emotion,
        intensity: e.intensity,
        tone: e.tone,
        triggerIndex: trigger >= 0 ? trigger : null,
      };
    }),
  }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
