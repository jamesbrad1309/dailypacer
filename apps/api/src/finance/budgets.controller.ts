import { Body, Controller, Get, HttpCode, Post, Put, Query, UseInterceptors } from "@nestjs/common";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import { type BudgetReport, BudgetsService } from "#finance/budgets.service";
import { toIsoDate } from "#finance/calendar.util";
import { CatchUpInterceptor } from "#finance/catch-up.interceptor";
import {
  type BudgetReportInput,
  budgetReportSchema,
  type RemoveBudgetInput,
  removeBudgetSchema,
  type SetBudgetInput,
  setBudgetSchema,
} from "#finance/dto/budget.dto";

// Auto-logged charges are brought up to date before every request here.
@UseInterceptors(CatchUpInterceptor)
@Controller("budgets")
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  /** `GET /budgets?month=2026-09&today=2026-09-25`: budget vs actual, with pace. */
  @Get()
  report(
    @Query(new ZodValidationPipe(budgetReportSchema)) input: BudgetReportInput,
  ): Promise<BudgetReport> {
    return this.budgets.report(input.month, input.today ?? toIsoDate(new Date()));
  }

  /** `PUT /budgets`: sets a category's limit from `month` on. */
  @Put()
  @HttpCode(204)
  async set(@Body(new ZodValidationPipe(setBudgetSchema)) input: SetBudgetInput): Promise<void> {
    await this.budgets.set(input);
  }

  /** `POST /budgets/remove`: no budget for the category from `month` on. */
  @Post("remove")
  @HttpCode(204)
  async remove(
    @Body(new ZodValidationPipe(removeBudgetSchema)) input: RemoveBudgetInput,
  ): Promise<void> {
    await this.budgets.remove(input.categoryId, input.month);
  }
}
