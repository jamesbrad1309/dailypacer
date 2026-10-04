import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PayeeRule } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import type { CreatePayeeRuleInput, UpdatePayeeRuleInput } from "#finance/dto/payee-rule.dto";
import { matchRule, payeeMatches } from "#finance/payee-rule.util";
import { TransactionsService } from "#finance/transactions.service";

const log = scopedLogger("PayeeRulesService");

/** How many uncategorised transactions "Apply rules" files in one go. */
const APPLY_LIMIT = 2000;

/**
 * Payee rules the user writes ("TESCO*" → Groceries). Quick log and CSV
 * import try them before payee history and category names; "Apply rules"
 * files what's already waiting in "To review".
 */
@Injectable()
export class PayeeRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
  ) {}

  /** In the order they're tried. */
  list(): Promise<PayeeRule[]> {
    return this.prisma.payeeRule.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  /** The category the first matching rule gives this payee, or null. */
  async categoryFor(payee: string | null | undefined): Promise<string | null> {
    if (!payee) return null;
    return matchRule(await this.list(), payee)?.categoryId ?? null;
  }

  /** Added last, so existing rules keep winning. */
  async create(input: CreatePayeeRuleInput): Promise<PayeeRule> {
    await this.assertCategory(input.categoryId);
    const last = await this.prisma.payeeRule.aggregate({ _max: { sortOrder: true } });
    const rule = await this.prisma.payeeRule.create({
      data: { ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    log.info({ ruleId: rule.id, pattern: rule.pattern }, "payee rule created");
    return rule;
  }

  async update(id: string, input: UpdatePayeeRuleInput): Promise<PayeeRule> {
    await this.findOne(id);
    if (input.categoryId) await this.assertCategory(input.categoryId);
    return this.prisma.payeeRule.update({ where: { id }, data: input });
  }

  async remove(id: string): Promise<PayeeRule> {
    await this.findOne(id);
    return this.prisma.payeeRule.delete({ where: { id } });
  }

  /** Uncategorised transactions (not transfers or splits) that a pattern would file now. */
  async matchCount(pattern: string): Promise<number> {
    const waiting = await this.uncategorised();
    return waiting.filter((t) => payeeMatches(pattern, t.payee)).length;
  }

  /**
   * Files every uncategorised transaction a rule matches, through
   * TransactionsService so the monthly totals follow. Returns how many.
   */
  async apply(): Promise<{ categorised: number }> {
    const [rules, waiting] = await Promise.all([this.list(), this.uncategorised()]);
    let categorised = 0;
    for (const t of waiting) {
      const rule = matchRule(rules, t.payee);
      if (!rule) continue;
      await this.transactions.update(t.id, { categoryId: rule.categoryId });
      categorised++;
    }
    log.info({ categorised, checked: waiting.length }, "payee rules applied");
    return { categorised };
  }

  private uncategorised() {
    return this.prisma.transaction.findMany({
      where: {
        categoryId: null,
        transferId: null,
        source: { not: "adjustment" },
        payee: { not: null },
        splits: { none: {} },
      },
      select: { id: true, payee: true },
      orderBy: { date: "desc" },
      take: APPLY_LIMIT,
    });
  }

  private async findOne(id: string): Promise<PayeeRule> {
    const rule = await this.prisma.payeeRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException(`Payee rule ${id} not found`);
    return rule;
  }

  private async assertCategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.archivedAt || category.isSystem) {
      throw new BadRequestException("categoryId must be an active, non-system category");
    }
  }
}
