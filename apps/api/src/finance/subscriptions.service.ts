import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  type Account,
  Prisma,
  type Subscription,
  type SubscriptionCharge,
  type SubscriptionPrice,
  type Transaction,
} from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import { fromIsoDate, toIsoDate } from "#finance/calendar.util";
import { CurrenciesService } from "#finance/currencies.service";
import { toMainMinor } from "#finance/currency-math.util";
import type {
  ChangePriceInput,
  ConfirmChargeInput,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from "#finance/dto/subscription.dto";
import { catalogService } from "#finance/subscription-catalog";
import {
  type Schedule,
  chargesBetween,
  isChargeDate,
  monthlyCost,
  nextCharge,
  previousDay,
  priceOn,
  yearlyCost,
} from "#finance/subscription-schedule.util";
import { TransactionsService } from "#finance/transactions.service";

const log = scopedLogger("SubscriptionsService");

type Loaded = Subscription & {
  prices: SubscriptionPrice[];
  account: Account;
  /** Answered charges from today on, when loaded: "next charge" skips them. */
  charges?: { dueOn: Date }[];
};

/** What a view needs: prices, the account's currency, and charges already answered ahead. */
const withDetails = (today: string) =>
  ({
    prices: true,
    account: true,
    charges: { where: { dueOn: { gte: fromIsoDate(today) } }, select: { dueOn: true } },
  }) satisfies Prisma.SubscriptionInclude;

export type SubscriptionStatus = "active" | "trial" | "paused" | "ending" | "ended";
export type ChargeStatus = "pending" | "confirmed" | "skipped" | "upcoming";

export interface SubscriptionView {
  id: string;
  name: string;
  isIncome: boolean;
  autoLog: boolean;
  serviceKey: string | null;
  domain: string | null;
  accountId: string;
  categoryId: string | null;
  interval: Subscription["interval"];
  intervalCount: number;
  firstChargeOn: string;
  trialEndsOn: string | null;
  endsOn: string | null;
  pausedAt: string | null;
  note: string | null;
  createdAt: string;
  status: SubscriptionStatus;
  /** The account's currency; every amount here is in it. */
  currency: string;
  /** The price of the next charge, or today's price once it has ended. */
  amountMinor: number;
  nextChargeOn: string | null;
  monthlyMinor: number;
  yearlyMinor: number;
  /** Newest first. */
  prices: { amountMinor: number; effectiveFrom: string }[];
}

export interface ChargeView {
  subscriptionId: string;
  dueOn: string;
  amountMinor: number;
  currency: string;
  status: ChargeStatus;
  /** Set when confirmed: the transaction it created. */
  transactionId: string | null;
  /** That transaction is still PENDING (auto-logged, not confirmed yet). */
  transactionPending: boolean;
  /** The first paid charge after a free trial. */
  afterTrial: boolean;
}

export interface SubscriptionSummary {
  /** The main currency every amount is in. */
  currency: string;
  /** Currencies left out for want of a rate. */
  unconverted: string[];
  /** Costs only: money-in subscriptions (a salary) are left out of these. */
  activeCount: number;
  monthlyMinor: number;
  yearlyMinor: number;
  /** Unpaid charges: overdue ones plus the next 30 days. */
  next30DaysMinor: number;
  pendingCount: number;
}

const iso = (date: Date | null): string | null => (date ? toIsoDate(date) : null);

function schedule(sub: Subscription): Schedule {
  return {
    interval: sub.interval,
    intervalCount: sub.intervalCount,
    firstChargeOn: toIsoDate(sub.firstChargeOn),
    endsOn: iso(sub.endsOn),
  };
}

function prices(sub: Loaded) {
  return sub.prices.map((p) => ({
    amountMinor: p.amountMinor,
    effectiveFrom: toIsoDate(p.effectiveFrom),
  }));
}

/**
 * The last day a charge can be due and still asked about: paused
 * subscriptions stop the day before they were paused.
 */
function lastAskable(sub: Subscription, today: string): string {
  if (!sub.pausedAt) return today;
  const paused = previousDay(toIsoDate(sub.pausedAt));
  return paused < today ? paused : today;
}

function status(sub: Subscription, today: string): SubscriptionStatus {
  const endsOn = iso(sub.endsOn);
  if (endsOn && endsOn <= today) return "ended";
  if (sub.pausedAt) return "paused";
  if (endsOn) return "ending";
  const trialEndsOn = iso(sub.trialEndsOn);
  if (trialEndsOn && today < trialEndsOn) return "trial";
  return "active";
}

/** A charge's transaction amount: money out is negative, a money-in subscription positive. */
function signedFor(sub: Subscription, amountMinor: number): number {
  return sub.isIncome ? amountMinor : -amountMinor;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Subscriptions whose charges the user confirms one at a time ("Ask each
 * time"): a due charge is pending until confirmed (which logs a real
 * transaction) or skipped. Charge dates come from the schedule
 * (subscription-schedule.util.ts); only answered charges are stored.
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
    private readonly currencies: CurrenciesService,
  ) {}

  async list(today: string, includeEnded = false): Promise<SubscriptionView[]> {
    const rows = await this.prisma.subscription.findMany({
      where: includeEnded ? {} : { OR: [{ endsOn: null }, { endsOn: { gt: fromIsoDate(today) } }] },
      include: withDetails(today),
      orderBy: { name: "asc" },
    });
    return rows.map((row) => this.view(row, today));
  }

  async get(id: string, today: string): Promise<SubscriptionView> {
    return this.view(await this.load(id, today), today);
  }

  async create(input: CreateSubscriptionInput): Promise<SubscriptionView> {
    await this.assertAccount(input.accountId);
    const service = input.serviceKey ? catalogService(input.serviceKey) : undefined;
    const categoryId =
      input.categoryId !== undefined
        ? input.categoryId
        : await this.categoryIdForKey(
            service?.categoryKey ?? (input.isIncome ? "salary" : "subscriptions"),
          );
    if (categoryId) await this.assertCategory(categoryId);

    const created = await this.prisma.subscription.create({
      data: {
        name: input.name,
        serviceKey: service?.key ?? null,
        domain: input.domain !== undefined ? input.domain : (service?.domain ?? null),
        accountId: input.accountId,
        categoryId,
        isIncome: input.isIncome,
        autoLog: input.autoLog,
        interval: input.interval,
        intervalCount: input.intervalCount,
        firstChargeOn: fromIsoDate(input.nextChargeOn),
        trialEndsOn: input.trialEndsOn ? fromIsoDate(input.trialEndsOn) : null,
        askFrom: fromIsoDate(input.today),
        note: input.note ?? null,
        prices: {
          create: { amountMinor: input.amountMinor, effectiveFrom: fromIsoDate(input.today) },
        },
      },
    });
    log.info(
      { subscriptionId: created.id, serviceKey: created.serviceKey },
      "subscription created",
    );
    return this.get(created.id, input.today);
  }

  async update(
    id: string,
    input: UpdateSubscriptionInput,
    today: string,
  ): Promise<SubscriptionView> {
    await this.load(id);
    if (input.accountId) await this.assertAccount(input.accountId);
    if (input.categoryId) await this.assertCategory(input.categoryId);
    await this.prisma.subscription.update({
      where: { id },
      data: {
        name: input.name,
        serviceKey: input.serviceKey,
        domain: input.domain,
        accountId: input.accountId,
        categoryId: input.categoryId,
        isIncome: input.isIncome,
        autoLog: input.autoLog,
        interval: input.interval,
        intervalCount: input.intervalCount,
        firstChargeOn: input.nextChargeOn ? fromIsoDate(input.nextChargeOn) : undefined,
        trialEndsOn:
          input.trialEndsOn === undefined
            ? undefined
            : input.trialEndsOn && fromIsoDate(input.trialEndsOn),
        note: input.note,
      },
    });
    log.info({ subscriptionId: id, fields: Object.keys(input) }, "subscription updated");
    return this.get(id, today);
  }

  /** A new price from `effectiveFrom` on; charges before it keep the old one. */
  async changePrice(id: string, input: ChangePriceInput, today: string): Promise<SubscriptionView> {
    await this.load(id);
    const effectiveFrom = fromIsoDate(input.effectiveFrom);
    await this.prisma.subscriptionPrice.upsert({
      where: { subscriptionId_effectiveFrom: { subscriptionId: id, effectiveFrom } },
      create: { subscriptionId: id, effectiveFrom, amountMinor: input.amountMinor },
      update: { amountMinor: input.amountMinor },
    });
    log.info({ subscriptionId: id, ...input }, "subscription price changed");
    return this.get(id, today);
  }

  async pause(id: string, today: string): Promise<SubscriptionView> {
    const sub = await this.load(id);
    if (!sub.pausedAt) {
      await this.prisma.subscription.update({ where: { id }, data: { pausedAt: new Date() } });
    }
    return this.get(id, today);
  }

  /** Charges that fell due while paused are never asked about. */
  async resume(id: string, today: string): Promise<SubscriptionView> {
    const sub = await this.load(id);
    if (sub.pausedAt) {
      await this.prisma.subscription.update({
        where: { id },
        data: { pausedAt: null, askFrom: this.later(sub.askFrom, today) },
      });
    }
    return this.get(id, today);
  }

  async cancel(id: string, endsOn: string, today: string): Promise<SubscriptionView> {
    await this.load(id);
    await this.prisma.subscription.update({ where: { id }, data: { endsOn: fromIsoDate(endsOn) } });
    log.info({ subscriptionId: id, endsOn }, "subscription cancelled");
    return this.get(id, today);
  }

  /** Undoes a cancellation. After one that had already ended, charges start again from today. */
  async reactivate(id: string, today: string): Promise<SubscriptionView> {
    const sub = await this.load(id);
    const ended = sub.endsOn && toIsoDate(sub.endsOn) <= today;
    await this.prisma.subscription.update({
      where: { id },
      data: { endsOn: null, askFrom: ended ? this.later(sub.askFrom, today) : undefined },
    });
    return this.get(id, today);
  }

  /** Deletes it and its history; transactions its charges created stay. */
  async remove(id: string): Promise<void> {
    await this.load(id);
    await this.prisma.subscription.delete({ where: { id } });
    log.info({ subscriptionId: id }, "subscription deleted");
  }

  /**
   * Every charge from `from` to `to`: answered ones with their outcome, due
   * ones still waiting as pending, later ones as upcoming. Paused
   * subscriptions have no upcoming charges.
   */
  async charges(from: string, to: string, today: string): Promise<ChargeView[]> {
    if (from > to) throw new BadRequestException("from must be on or before to");
    const [subs, answered] = await Promise.all([
      this.prisma.subscription.findMany({ include: { prices: true, account: true } }),
      this.prisma.subscriptionCharge.findMany({
        where: { dueOn: { gte: fromIsoDate(from), lte: fromIsoDate(to) } },
        include: { transaction: { select: { amountMinor: true, status: true } } },
      }),
    ]);
    const byKey = new Map(answered.map((c) => [`${c.subscriptionId}|${toIsoDate(c.dueOn)}`, c]));

    const result: ChargeView[] = [];
    for (const sub of subs) {
      const askFrom = toIsoDate(sub.askFrom);
      const lastPending = lastAskable(sub, today);
      const firstAfterTrial = sub.trialEndsOn
        ? nextCharge(schedule(sub), toIsoDate(sub.trialEndsOn))
        : null;
      const autoLoggedThrough = iso(sub.autoLoggedThrough);
      for (const dueOn of chargesBetween(schedule(sub), from, to)) {
        const charge = byKey.get(`${sub.id}|${dueOn}`);
        let chargeStatus: ChargeStatus;
        if (charge) chargeStatus = charge.outcome === "CONFIRMED" ? "confirmed" : "skipped";
        else if (dueOn < askFrom) continue;
        // Auto-logging covered this date, but its transaction was deleted: it didn't happen.
        else if (autoLoggedThrough && dueOn <= autoLoggedThrough) chargeStatus = "skipped";
        else if (dueOn <= today) {
          if (dueOn > lastPending) continue;
          chargeStatus = "pending";
        } else {
          if (sub.pausedAt) continue;
          chargeStatus = "upcoming";
        }
        result.push(this.chargeView(sub, dueOn, chargeStatus, charge, firstAfterTrial));
      }
    }
    return result.sort(
      (a, b) => a.dueOn.localeCompare(b.dueOn) || a.subscriptionId.localeCompare(b.subscriptionId),
    );
  }

  /**
   * Auto-logging, run before finance requests (finance/catch-up.interceptor.ts)
   * instead of on a timer: every due charge of an auto-log subscription,
   * up to `today`, becomes a PENDING transaction. Idempotent: each
   * subscription is locked while it's caught up, and `autoLoggedThrough`
   * moves to today in the same database transaction, so concurrent or
   * repeated runs log nothing twice. Returns how many were logged.
   */
  async catchUp(today: string): Promise<number> {
    const due = await this.prisma.subscription.findMany({
      where: {
        autoLog: true,
        OR: [{ autoLoggedThrough: null }, { autoLoggedThrough: { lt: fromIsoDate(today) } }],
      },
      select: { id: true },
    });
    let logged = 0;
    for (const { id } of due) logged += await this.autoLogOne(id, today);
    if (logged) log.info({ logged, today }, "auto-logged subscription charges");
    return logged;
  }

  private async autoLogOne(id: string, today: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      // A concurrent catch-up waits here, then finds autoLoggedThrough already moved.
      await tx.$queryRaw`SELECT "id" FROM "subscriptions" WHERE "id" = ${id} FOR UPDATE`;
      const sub = await tx.subscription.findUnique({
        where: { id },
        include: { prices: true, account: true, charges: { select: { dueOn: true } } },
      });
      const through = iso(sub?.autoLoggedThrough ?? null);
      if (!sub?.autoLog || (through && through >= today)) return 0;

      // Never before it was added, the last run, or the account's opening day.
      const start = [
        toIsoDate(sub.askFrom),
        through ? this.addDays(through, 1) : "",
        toIsoDate(sub.account.openingBalanceDate),
      ].sort()[2];
      const end = lastAskable(sub, today);
      const answered = new Set(sub.charges.map((c) => toIsoDate(c.dueOn)));
      let logged = 0;
      if (start <= end && !sub.account.archivedAt) {
        for (const dueOn of chargesBetween(schedule(sub), start, end)) {
          if (answered.has(dueOn)) continue;
          const clientId = `subscription:${id}:${dueOn}`;
          const transaction =
            (await tx.transaction.findUnique({ where: { clientId } })) ??
            (await this.transactions.createIn(
              tx,
              {
                accountId: sub.accountId,
                categoryId: sub.categoryId,
                date: dueOn,
                amountMinor: signedFor(sub, priceOn(prices(sub), dueOn)),
                payee: sub.name,
                status: "PENDING",
              },
              "recurring",
              clientId,
            ));
          await tx.subscriptionCharge.create({
            data: {
              subscriptionId: id,
              dueOn: fromIsoDate(dueOn),
              outcome: "CONFIRMED",
              transactionId: transaction.id,
            },
          });
          logged++;
        }
      }
      await tx.subscription.update({
        where: { id },
        data: { autoLoggedThrough: fromIsoDate(today) },
      });
      return logged;
    });
  }

  /** Due charges nobody has answered yet, oldest first. */
  async pending(today: string): Promise<ChargeView[]> {
    const earliest = await this.prisma.subscription.findFirst({
      orderBy: { askFrom: "asc" },
      select: { askFrom: true },
    });
    if (!earliest) return [];
    const all = await this.charges(toIsoDate(earliest.askFrom), today, today);
    return all.filter((c) => c.status === "pending");
  }

  async pendingCount(today: string): Promise<number> {
    return (await this.pending(today)).length;
  }

  /** Logs the charge as a real transaction (payee = the subscription's name). */
  async confirm(id: string, input: ConfirmChargeInput): Promise<Transaction> {
    const sub = await this.load(id);
    this.assertChargeDate(sub, input.dueOn);
    const dueOn = fromIsoDate(input.dueOn);
    const existing = await this.prisma.subscriptionCharge.findUnique({
      where: { subscriptionId_dueOn: { subscriptionId: id, dueOn } },
    });
    if (existing) throw new ConflictException("That charge has already been answered");

    // Deterministic, so a retry after a half-finished confirm finds the
    // transaction it already made instead of logging a second one.
    const clientId = `subscription:${id}:${input.dueOn}`;
    let transaction = await this.prisma.transaction.findUnique({ where: { clientId } });
    if (!transaction) {
      try {
        transaction = await this.transactions.create(
          {
            accountId: sub.accountId,
            categoryId: sub.categoryId,
            date: input.date ?? input.dueOn,
            amountMinor: signedFor(sub, input.amountMinor ?? priceOn(prices(sub), input.dueOn)),
            payee: sub.name,
          },
          "recurring",
          clientId,
        );
      } catch (err) {
        if (isUniqueViolation(err))
          throw new ConflictException("That charge is already being logged");
        throw err;
      }
    }
    try {
      await this.prisma.subscriptionCharge.create({
        data: { subscriptionId: id, dueOn, outcome: "CONFIRMED", transactionId: transaction.id },
      });
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictException("That charge has already been answered");
      throw err;
    }
    log.info(
      { subscriptionId: id, dueOn: input.dueOn, transactionId: transaction.id },
      "charge confirmed",
    );
    return transaction;
  }

  /** Not charged, or already logged some other way (quick log, a CSV import). */
  async skip(id: string, dueOnIso: string): Promise<void> {
    const sub = await this.load(id);
    this.assertChargeDate(sub, dueOnIso);
    try {
      await this.prisma.subscriptionCharge.create({
        data: { subscriptionId: id, dueOn: fromIsoDate(dueOnIso), outcome: "SKIPPED" },
      });
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictException("That charge has already been answered");
      throw err;
    }
    log.info({ subscriptionId: id, dueOn: dueOnIso }, "charge skipped");
  }

  /** Undo: back to pending. A confirmed charge's transaction is deleted too. */
  async reopen(id: string, dueOnIso: string): Promise<void> {
    const charge = await this.prisma.subscriptionCharge.findUnique({
      where: { subscriptionId_dueOn: { subscriptionId: id, dueOn: fromIsoDate(dueOnIso) } },
    });
    if (!charge) return;
    // Deleting the transaction deletes the charge with it (onDelete: Cascade)
    // and takes it out of the monthly totals.
    if (charge.transactionId) await this.transactions.remove(charge.transactionId);
    else await this.prisma.subscriptionCharge.delete({ where: { id: charge.id } });
    log.info({ subscriptionId: id, dueOn: dueOnIso }, "charge reopened");
  }

  async summary(today: string): Promise<SubscriptionSummary> {
    const [subs, ctx, upcoming] = await Promise.all([
      this.list(today),
      this.currencies.conversionContext(),
      this.charges(today, this.addDays(today, 29), today),
    ]);
    const pending = await this.pending(today);
    const unconverted = new Set<string>();
    const toMain = (minor: number, currency: string) => {
      const converted = toMainMinor(ctx, minor, currency, today);
      if (converted === null) unconverted.add(currency);
      return converted ?? 0;
    };

    const costs = new Set(subs.filter((s) => !s.isIncome).map((s) => s.id));
    const active = subs.filter(
      (s) => costs.has(s.id) && s.status !== "paused" && s.status !== "ended",
    );
    const due = [...pending.filter((c) => c.dueOn < today), ...upcoming].filter(
      (c) => costs.has(c.subscriptionId) && (c.status === "pending" || c.status === "upcoming"),
    );
    return {
      currency: ctx.main,
      unconverted: [...unconverted],
      activeCount: active.length,
      monthlyMinor: active.reduce((sum, s) => sum + toMain(s.monthlyMinor, s.currency), 0),
      yearlyMinor: active.reduce((sum, s) => sum + toMain(s.yearlyMinor, s.currency), 0),
      next30DaysMinor: due.reduce((sum, c) => sum + toMain(c.amountMinor, c.currency), 0),
      pendingCount: pending.length,
    };
  }

  private view(sub: Loaded, today: string): SubscriptionView {
    const history = prices(sub);
    const s = status(sub, today);
    const next = s === "paused" || s === "ended" ? null : this.nextUnanswered(sub, today);
    const amountMinor = priceOn(history, next ?? today);
    return {
      id: sub.id,
      name: sub.name,
      isIncome: sub.isIncome,
      autoLog: sub.autoLog,
      serviceKey: sub.serviceKey,
      domain: sub.domain,
      accountId: sub.accountId,
      categoryId: sub.categoryId,
      interval: sub.interval,
      intervalCount: sub.intervalCount,
      firstChargeOn: toIsoDate(sub.firstChargeOn),
      trialEndsOn: iso(sub.trialEndsOn),
      endsOn: iso(sub.endsOn),
      pausedAt: sub.pausedAt?.toISOString() ?? null,
      note: sub.note,
      createdAt: sub.createdAt.toISOString(),
      status: s,
      currency: sub.account.currency,
      amountMinor,
      nextChargeOn: next,
      monthlyMinor: monthlyCost(amountMinor, sub.interval, sub.intervalCount),
      yearlyMinor: yearlyCost(amountMinor, sub.interval, sub.intervalCount),
      prices: history.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)),
    };
  }

  private chargeView(
    sub: Loaded,
    dueOn: string,
    chargeStatus: ChargeStatus,
    charge:
      | (SubscriptionCharge & { transaction: { amountMinor: number; status: string } | null })
      | undefined,
    firstAfterTrial: string | null,
  ): ChargeView {
    return {
      subscriptionId: sub.id,
      dueOn,
      // A confirmed charge shows what was actually logged; others the listed price.
      amountMinor: charge?.transaction
        ? Math.abs(charge.transaction.amountMinor)
        : priceOn(prices(sub), dueOn),
      currency: sub.account.currency,
      status: chargeStatus,
      transactionId: charge?.transactionId ?? null,
      transactionPending: charge?.transaction?.status === "PENDING",
      afterTrial: dueOn === firstAfterTrial,
    };
  }

  /** The first charge on or after today that hasn't been confirmed or skipped yet. */
  private nextUnanswered(sub: Loaded, today: string): string | null {
    const answered = new Set(sub.charges?.map((c) => toIsoDate(c.dueOn)));
    let next = nextCharge(schedule(sub), today);
    for (let i = 0; next && answered.has(next) && i < 1000; i++) {
      next = nextCharge(schedule(sub), this.addDays(next, 1));
    }
    return next;
  }

  private async load(id: string, today?: string): Promise<Loaded> {
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
      include: today ? withDetails(today) : { prices: true, account: true },
    });
    if (!sub) throw new NotFoundException(`Subscription ${id} not found`);
    return sub;
  }

  private assertChargeDate(sub: Subscription, dueOn: string): void {
    if (!isChargeDate(schedule(sub), dueOn)) {
      throw new BadRequestException(`${sub.name} isn't charged on ${dueOn}`);
    }
  }

  private async assertAccount(accountId: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new BadRequestException(`Account ${accountId} not found`);
    if (account.archivedAt) throw new BadRequestException(`${account.name} is archived`);
  }

  private async assertCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new BadRequestException(`Category ${categoryId} not found`);
  }

  private async categoryIdForKey(key: string): Promise<string | null> {
    const category = await this.prisma.category.findFirst({
      where: { metadata: { path: ["key"], equals: key }, archivedAt: null },
      select: { id: true },
    });
    return category?.id ?? null;
  }

  private later(date: Date, today: string): Date {
    return toIsoDate(date) > today ? date : fromIsoDate(today);
  }

  private addDays(iso: string, days: number): string {
    return toIsoDate(new Date(fromIsoDate(iso).getTime() + days * 86_400_000));
  }
}
