import { Injectable } from "@nestjs/common";
import type { Category } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { currentUserId } from "#common/database/request-context";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import { CurrenciesService } from "#finance/currencies.service";
import { toMainMinor } from "#finance/currency-math.util";

export interface CategorySpend {
  /** Null: uncategorised ("To review"). */
  category: Category | null;
  /** Out minus refunds in: what this category cost this month. */
  spentMinor: number;
  previousSpentMinor: number;
  transactionCount: number;
}

export interface SpendReport {
  /** "YYYY-MM" */
  month: string;
  /** The main currency every figure is converted into. */
  currency: string;
  /** Currencies left out because there's no rate for them yet. */
  unconverted: string[];
  spentMinor: number;
  previousSpentMinor: number;
  /** Net money in under income categories. */
  incomeMinor: number;
  /** Biggest spend first. */
  categories: CategorySpend[];
}

export interface CashFlowMonth {
  /** "YYYY-MM" */
  month: string;
  /** Net money in under income categories. */
  inMinor: number;
  /** Spending: out minus refunds, the same figure as the Spending page. */
  outMinor: number;
  /** in − out: positive when the month saved money. */
  netMinor: number;
}

export interface CashFlowReport {
  currency: string;
  unconverted: string[];
  /** Oldest first, every month in the range even when it's empty. */
  months: CashFlowMonth[];
}

export interface TopPayee {
  /** As most often written. */
  payee: string;
  /** Out minus refunds over the range, in the main currency. */
  spentMinor: number;
  transactionCount: number;
}

export interface TopPayeesReport {
  from: string;
  to: string;
  currency: string;
  unconverted: string[];
  /** Biggest spend first. */
  payees: TopPayee[];
}

export interface NetWorthMonth {
  /** "YYYY-MM": balances at the end of it (today, for the current month). */
  month: string;
  assetsMinor: number;
  /** Owed, as a positive amount. */
  liabilitiesMinor: number;
  netWorthMinor: number;
}

export interface NetWorthReport {
  currency: string;
  unconverted: string[];
  /** Oldest first. */
  months: NetWorthMonth[];
}

/**
 * Each account's balance at the end of every month in `months` (oldest
 * first): its opening balance plus every transaction up to then. An account
 * opened after a month ended has no balance that month (undefined).
 */
export function balancesByMonth(
  accounts: { id: string; openingBalanceMinor: number; openingMonth: string }[],
  sums: { accountId: string; month: string; amountMinor: number }[],
  months: string[],
): Map<string, (number | undefined)[]> {
  const result = new Map<string, (number | undefined)[]>();
  for (const account of accounts) {
    const own = sums.filter((s) => s.accountId === account.id);
    // Everything before the first month shown, then each month's on top.
    let running =
      account.openingBalanceMinor +
      own.filter((s) => s.month < months[0]).reduce((sum, s) => sum + s.amountMinor, 0);
    result.set(
      account.id,
      months.map((month) => {
        running += own.filter((s) => s.month === month).reduce((sum, s) => sum + s.amountMinor, 0);
        return account.openingMonth <= month ? running : undefined;
      }),
    );
  }
  return result;
}

/** The date a month's figures convert at: its last day, or today while it's still going. */
export function rateDate(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return lastDay < today ? lastDay : today;
}

/** "2026-09" → "2026-08". */
export function previousMonth(month: string): string {
  return shiftMonth(month, -1);
}

/** "2026-09" shifted by `months`: −3 → "2026-06". */
export function shiftMonth(month: string, months: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 7);
}

/**
 * Reports over `monthly_totals` (see MonthlyTotalsService): a month is a few
 * dozen pre-summed rows, however many transactions it holds.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencies: CurrenciesService,
  ) {}

  /**
   * Spend per category for a month, next to the month before. Refunds
   * (money in under an expense category) reduce that category's spend;
   * income categories count towards `incomeMinor` instead.
   */
  async spendByCategory(month: string, accountId?: string): Promise<SpendReport> {
    const previous = previousMonth(month);
    const rows = await this.prisma.monthlyTotal.findMany({
      where: {
        month: { in: [fromIsoDate(`${month}-01`), fromIsoDate(`${previous}-01`)] },
        ...(accountId ? { accountId } : {}),
      },
      include: { category: true, account: { select: { currency: true } } },
    });
    const ctx = await this.currencies.conversionContext();
    const unconverted = new Set<string>();

    const byCategory = new Map<string | null, CategorySpend>();
    let incomeMinor = 0;
    for (const row of rows) {
      const current = row.month.toISOString().startsWith(month);
      // Each month converts at its own rate: its last day's, or today's if it isn't over.
      const net = toMainMinor(
        ctx,
        row.outflowMinor - row.inflowMinor,
        row.account.currency,
        rateDate(toIsoDate(row.month).slice(0, 7)),
      );
      if (net === null) {
        unconverted.add(row.account.currency);
        continue;
      }
      if (row.category?.kind === "income") {
        if (current) incomeMinor -= net;
        continue;
      }
      let entry = byCategory.get(row.categoryId);
      if (!entry) {
        entry = {
          category: row.category,
          spentMinor: 0,
          previousSpentMinor: 0,
          transactionCount: 0,
        };
        byCategory.set(row.categoryId, entry);
      }
      if (current) {
        entry.spentMinor += net;
        entry.transactionCount += row.transactionCount;
      } else {
        entry.previousSpentMinor += net;
      }
    }

    const categories = [...byCategory.values()]
      .filter((c) => c.transactionCount > 0 || c.previousSpentMinor !== 0)
      .sort((a, b) => b.spentMinor - a.spentMinor || b.previousSpentMinor - a.previousSpentMinor);
    return {
      month,
      currency: ctx.main,
      unconverted: [...unconverted].sort(),
      spentMinor: categories.reduce((sum, c) => sum + c.spentMinor, 0),
      previousSpentMinor: categories.reduce((sum, c) => sum + c.previousSpentMinor, 0),
      incomeMinor,
      categories,
    };
  }

  /**
   * Money in vs out per month, for `months` months up to and including
   * `to`. Same rules as spendByCategory: transfers and balance adjustments
   * don't count, refunds reduce spending, income categories are money in.
   */
  async cashFlow(to: string, months: number): Promise<CashFlowReport> {
    const from = shiftMonth(to, -(months - 1));
    const rows = await this.prisma.monthlyTotal.findMany({
      where: { month: { gte: fromIsoDate(`${from}-01`), lte: fromIsoDate(`${to}-01`) } },
      include: {
        category: { select: { kind: true } },
        account: { select: { currency: true } },
      },
    });
    const ctx = await this.currencies.conversionContext();
    const unconverted = new Set<string>();

    const byMonth = new Map<string, CashFlowMonth>();
    for (let i = 0; i < months; i++) {
      const month = shiftMonth(from, i);
      byMonth.set(month, { month, inMinor: 0, outMinor: 0, netMinor: 0 });
    }
    for (const row of rows) {
      const month = toIsoDate(row.month).slice(0, 7);
      const net = toMainMinor(
        ctx,
        row.outflowMinor - row.inflowMinor,
        row.account.currency,
        rateDate(month),
      );
      if (net === null) {
        unconverted.add(row.account.currency);
        continue;
      }
      const entry = byMonth.get(month);
      if (!entry) continue;
      if (row.category?.kind === "income") entry.inMinor -= net;
      else entry.outMinor += net;
    }
    const list = [...byMonth.values()];
    for (const m of list) m.netMinor = m.inMinor - m.outMinor;
    return { currency: ctx.main, unconverted: [...unconverted].sort(), months: list };
  }

  /**
   * Where the money went, by payee, between two days: out minus refunds,
   * leaving out transfers, balance adjustments and income. Payees are
   * matched ignoring case and surrounding spaces; each month converts at
   * its own rate, as in the other reports.
   */
  async topPayees(from: string, to: string, limit: number): Promise<TopPayeesReport> {
    const rows = await this.prisma.$queryRaw<
      { key: string; payee: string; currency: string; month: string; net: number; count: number }[]
    >`
      SELECT lower(trim(t."payee")) AS "key",
             mode() WITHIN GROUP (ORDER BY trim(t."payee")) AS "payee",
             a."currency",
             to_char(t."date", 'YYYY-MM') AS "month",
             (-SUM(t."amountMinor"))::int AS "net",
             COUNT(*)::int AS "count"
      FROM "transactions" t
      JOIN "accounts" a ON a."id" = t."accountId"
      LEFT JOIN "categories" c ON c."id" = t."categoryId"
      WHERE t."userId" = ${currentUserId()}
        AND t."date" BETWEEN ${fromIsoDate(from)} AND ${fromIsoDate(to)}
        AND t."transferId" IS NULL AND t."source" <> 'adjustment'
        AND t."payee" IS NOT NULL AND trim(t."payee") <> ''
        AND (c."kind" IS NULL OR c."kind" <> 'income')
      GROUP BY 1, 3, 4`;
    const ctx = await this.currencies.conversionContext();
    const unconverted = new Set<string>();
    const byPayee = new Map<string, TopPayee & { names: Map<string, number> }>();
    for (const row of rows) {
      const net = toMainMinor(ctx, row.net, row.currency, rateDate(row.month));
      if (net === null) {
        unconverted.add(row.currency);
        continue;
      }
      const entry = byPayee.get(row.key) ?? {
        payee: row.payee,
        spentMinor: 0,
        transactionCount: 0,
        names: new Map<string, number>(),
      };
      entry.spentMinor += net;
      entry.transactionCount += row.count;
      entry.names.set(row.payee, (entry.names.get(row.payee) ?? 0) + row.count);
      byPayee.set(row.key, entry);
    }
    const payees = [...byPayee.values()]
      .filter((p) => p.spentMinor > 0)
      .sort((a, b) => b.spentMinor - a.spentMinor || b.transactionCount - a.transactionCount)
      .slice(0, limit)
      .map(({ names, ...p }) => ({
        ...p,
        payee: [...names].sort((a, b) => b[1] - a[1])[0]?.[0] ?? p.payee,
      }));
    return { from, to, currency: ctx.main, unconverted: [...unconverted].sort(), payees };
  }

  /**
   * Net worth at the end of each of `months` months up to `to`: every
   * account's balance then (opening balance plus all its transactions,
   * transfers and adjustments included), converted at that month's rate,
   * split into what you own and what you owe.
   */
  async netWorth(to: string, months: number): Promise<NetWorthReport> {
    const monthList = Array.from({ length: months }, (_, i) => shiftMonth(to, i - (months - 1)));
    const [y, m] = to.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0));
    const [accounts, sums] = await Promise.all([
      this.prisma.account.findMany({
        select: { id: true, currency: true, openingBalanceMinor: true, openingBalanceDate: true },
      }),
      this.prisma.$queryRaw<{ accountId: string; month: string; amountMinor: number }[]>`
        SELECT "accountId", to_char("date", 'YYYY-MM') AS "month",
               SUM("amountMinor")::int AS "amountMinor"
        FROM "transactions"
        WHERE "userId" = ${currentUserId()} AND "date" <= ${lastDay}
        GROUP BY 1, 2`,
    ]);
    const balances = balancesByMonth(
      accounts.map((a) => ({
        id: a.id,
        openingBalanceMinor: a.openingBalanceMinor,
        openingMonth: toIsoDate(a.openingBalanceDate).slice(0, 7),
      })),
      sums,
      monthList,
    );
    const ctx = await this.currencies.conversionContext();
    const unconverted = new Set<string>();
    const result = monthList.map((month, i) => {
      let assetsMinor = 0;
      let liabilitiesMinor = 0;
      for (const account of accounts) {
        const balance = balances.get(account.id)?.[i];
        if (balance === undefined || balance === 0) continue;
        const main = toMainMinor(ctx, balance, account.currency, rateDate(month));
        if (main === null) {
          unconverted.add(account.currency);
          continue;
        }
        if (main >= 0) assetsMinor += main;
        else liabilitiesMinor -= main;
      }
      return {
        month,
        assetsMinor,
        liabilitiesMinor,
        netWorthMinor: assetsMinor - liabilitiesMinor,
      };
    });
    return { currency: ctx.main, unconverted: [...unconverted].sort(), months: result };
  }
}
