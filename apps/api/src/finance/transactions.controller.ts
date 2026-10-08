import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import type { Transaction, TransactionSplit } from "@prisma/client";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import { toIsoDate } from "#finance/calendar.util";
import { CatchUpInterceptor } from "#finance/catch-up.interceptor";
import { todaySchema } from "#finance/dto/subscription.dto";
import {
  type CreateTransactionInput,
  type CreateTransferInput,
  createTransactionSchema,
  createTransferSchema,
  type ListTransactionsInput,
  listTransactionsSchema,
  type SetSplitsInput,
  setSplitsSchema,
  type UpdateTransactionInput,
  updateTransactionSchema,
} from "#finance/dto/transaction.dto";
import { SubscriptionsService } from "#finance/subscriptions.service";
import { TransactionsService } from "#finance/transactions.service";

/**
 * `date` is a `@db.Date` column: "YYYY-MM-DD" on the wire, like habit
 * entries. `splits` is empty unless the transaction is split.
 */
export function toTransactionDto(t: Transaction & { splits?: TransactionSplit[] }) {
  return {
    ...t,
    date: toIsoDate(t.date),
    splits: (t.splits ?? []).map(({ id, categoryId, amountMinor, note }) => ({
      id,
      categoryId,
      amountMinor,
      note,
    })),
  };
}

// Auto-logged charges are brought up to date before every request here.
@UseInterceptors(CatchUpInterceptor)
@Controller("transactions")
export class TransactionsController {
  constructor(
    private readonly transactions: TransactionsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /**
   * `GET /transactions?accountId&categoryId&from&to&search&tag&uncategorised&first&after`:
   * newest first, cursor-paginated.
   */
  @Get()
  async list(@Query(new ZodValidationPipe(listTransactionsSchema)) input: ListTransactionsInput) {
    const page = await this.transactions.list(input);
    return { items: page.items.map(toTransactionDto), nextCursor: page.nextCursor };
  }

  /** `GET /transactions/tags`: every tag in use with how many transactions carry it, most used first. */
  @Get("tags")
  tags() {
    return this.transactions.tagCounts();
  }

  /**
   * `GET /transactions/to-review-count?today=YYYY-MM-DD`: the "To review"
   * inbox holds uncategorised or pending transactions, and subscription
   * charges waiting to be confirmed.
   */
  @Get("to-review-count")
  async toReviewCount(
    @Query(new ZodValidationPipe(todaySchema.partial())) query: { today?: string },
  ) {
    const [transactions, charges] = await Promise.all([
      this.transactions.toReviewCount(),
      this.subscriptions.pendingCount(query.today ?? toIsoDate(new Date())),
    ]);
    return { count: transactions + charges, transactions, charges };
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return toTransactionDto(await this.transactions.findOne(id));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createTransactionSchema)) input: CreateTransactionInput,
  ) {
    return toTransactionDto(await this.transactions.create(input));
  }

  /** `POST /transactions/transfers`: both legs; returns [out, in]. */
  @Post("transfers")
  async transfer(@Body(new ZodValidationPipe(createTransferSchema)) input: CreateTransferInput) {
    return (await this.transactions.createTransfer(input)).map(toTransactionDto);
  }

  /** Partial: only the fields sent change. Categorising from the inbox sends just `categoryId`. */
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTransactionSchema)) input: UpdateTransactionInput,
  ) {
    return toTransactionDto(await this.transactions.update(id, input));
  }

  /** Splits it across categories (the parts add up to its amount); `splits: []` undoes it. */
  @Put(":id/splits")
  async setSplits(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(setSplitsSchema)) input: SetSplitsInput,
  ) {
    return toTransactionDto(await this.transactions.setSplits(id, input));
  }

  /** Returns every id deleted: both legs, for a transfer. */
  @Delete(":id")
  remove(@Param("id") id: string): Promise<{ ids: string[] }> {
    return this.transactions.remove(id);
  }
}
