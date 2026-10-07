import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from "@nestjs/common";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import { toIsoDate } from "#finance/calendar.util";
import { CatchUpInterceptor } from "#finance/catch-up.interceptor";
import {
  type CancelInput,
  type ChangePriceInput,
  type ChargeInput,
  type ChargeRangeInput,
  type ConfirmChargeInput,
  type CreateSubscriptionInput,
  cancelSchema,
  changePriceSchema,
  chargeRangeSchema,
  chargeSchema,
  confirmChargeSchema,
  createSubscriptionSchema,
  type ListSubscriptionsInput,
  listSubscriptionsSchema,
  searchServicesSchema,
  todaySchema,
  type UpdateSubscriptionInput,
  updateSubscriptionSchema,
} from "#finance/dto/subscription.dto";
import { type CatalogService, searchCatalog } from "#finance/subscription-catalog";
import {
  type ChargeView,
  type SubscriptionSummary,
  SubscriptionsService,
  type SubscriptionView,
} from "#finance/subscriptions.service";
import { toTransactionDto } from "#finance/transactions.controller";

/**
 * The client's calendar day, as `?today=YYYY-MM-DD`: what's due depends on
 * the user's date, not the server's. Falls back to the server's (UTC) day.
 */
const todayPipe = new ZodValidationPipe(todaySchema.partial());
const today = (query: { today?: string }) => query.today ?? toIsoDate(new Date());
const id = new ParseUUIDPipe();

// Auto-logged charges are brought up to date before every request here.
@UseInterceptors(CatchUpInterceptor)
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listSubscriptionsSchema)) input: ListSubscriptionsInput,
  ): Promise<SubscriptionView[]> {
    return this.subscriptions.list(input.today, input.includeEnded);
  }

  /** `GET /subscriptions/services?q=net`: the built-in catalog to pick from. */
  @Get("services")
  services(
    @Query(new ZodValidationPipe(searchServicesSchema)) input: { q?: string },
  ): CatalogService[] {
    return searchCatalog(input.q ?? "");
  }

  @Get("summary")
  summary(@Query(todayPipe) query: { today?: string }): Promise<SubscriptionSummary> {
    return this.subscriptions.summary(today(query));
  }

  /** `GET /subscriptions/charges?from=…&to=…&today=…`: for the calendar and the upcoming list. */
  @Get("charges")
  charges(
    @Query(new ZodValidationPipe(chargeRangeSchema)) input: ChargeRangeInput,
  ): Promise<ChargeView[]> {
    return this.subscriptions.charges(input.from, input.to, input.today);
  }

  @Get("pending")
  pending(@Query(todayPipe) query: { today?: string }): Promise<ChargeView[]> {
    return this.subscriptions.pending(today(query));
  }

  @Get(":id")
  get(
    @Param("id", id) subscriptionId: string,
    @Query(todayPipe) query: { today?: string },
  ): Promise<SubscriptionView> {
    return this.subscriptions.get(subscriptionId, today(query));
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createSubscriptionSchema)) input: CreateSubscriptionInput,
  ): Promise<SubscriptionView> {
    return this.subscriptions.create(input);
  }

  @Patch(":id")
  update(
    @Param("id", id) subscriptionId: string,
    @Body(new ZodValidationPipe(updateSubscriptionSchema)) input: UpdateSubscriptionInput,
    @Query(todayPipe) query: { today?: string },
  ): Promise<SubscriptionView> {
    return this.subscriptions.update(subscriptionId, input, today(query));
  }

  @Post(":id/price")
  changePrice(
    @Param("id", id) subscriptionId: string,
    @Body(new ZodValidationPipe(changePriceSchema)) input: ChangePriceInput,
    @Query(todayPipe) query: { today?: string },
  ): Promise<SubscriptionView> {
    return this.subscriptions.changePrice(subscriptionId, input, today(query));
  }

  @Post(":id/pause")
  pause(
    @Param("id", id) subscriptionId: string,
    @Query(todayPipe) query: { today?: string },
  ): Promise<SubscriptionView> {
    return this.subscriptions.pause(subscriptionId, today(query));
  }

  @Post(":id/resume")
  resume(
    @Param("id", id) subscriptionId: string,
    @Query(todayPipe) query: { today?: string },
  ): Promise<SubscriptionView> {
    return this.subscriptions.resume(subscriptionId, today(query));
  }

  @Post(":id/cancel")
  cancel(
    @Param("id", id) subscriptionId: string,
    @Body(new ZodValidationPipe(cancelSchema)) input: CancelInput,
    @Query(todayPipe) query: { today?: string },
  ): Promise<SubscriptionView> {
    return this.subscriptions.cancel(subscriptionId, input.endsOn, today(query));
  }

  @Post(":id/reactivate")
  reactivate(
    @Param("id", id) subscriptionId: string,
    @Query(todayPipe) query: { today?: string },
  ): Promise<SubscriptionView> {
    return this.subscriptions.reactivate(subscriptionId, today(query));
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id", id) subscriptionId: string): Promise<void> {
    await this.subscriptions.remove(subscriptionId);
  }

  @Post(":id/charges/confirm")
  async confirm(
    @Param("id", id) subscriptionId: string,
    @Body(new ZodValidationPipe(confirmChargeSchema)) input: ConfirmChargeInput,
  ) {
    return toTransactionDto(await this.subscriptions.confirm(subscriptionId, input));
  }

  @Post(":id/charges/skip")
  @HttpCode(204)
  async skip(
    @Param("id", id) subscriptionId: string,
    @Body(new ZodValidationPipe(chargeSchema)) input: ChargeInput,
  ): Promise<void> {
    await this.subscriptions.skip(subscriptionId, input.dueOn);
  }

  @Post(":id/charges/reopen")
  @HttpCode(204)
  async reopen(
    @Param("id", id) subscriptionId: string,
    @Body(new ZodValidationPipe(chargeSchema)) input: ChargeInput,
  ): Promise<void> {
    await this.subscriptions.reopen(subscriptionId, input.dueOn);
  }
}
