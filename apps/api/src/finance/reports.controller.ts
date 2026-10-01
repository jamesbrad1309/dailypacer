import { BadRequestException, Controller, Get, Post, Query, UseInterceptors } from "@nestjs/common";
import { CatchUpInterceptor } from "#finance/catch-up.interceptor";
import { MonthlyTotalsService, type RebuildResult } from "#finance/monthly-totals.service";
import { type CashFlowReport, ReportsService, type SpendReport } from "#finance/reports.service";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f-]{36}$/i;

// Auto-logged charges are brought up to date before every request here.
@UseInterceptors(CatchUpInterceptor)
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly totals: MonthlyTotalsService,
  ) {}

  /** `GET /reports/spend-by-category?month=2026-09[&accountId=…]` */
  @Get("spend-by-category")
  spendByCategory(
    @Query("month") month?: string,
    @Query("accountId") accountId?: string,
  ): Promise<SpendReport> {
    if (!month || !MONTH.test(month)) throw new BadRequestException("month must be YYYY-MM");
    if (accountId !== undefined && !UUID.test(accountId)) {
      throw new BadRequestException("accountId must be a UUID");
    }
    return this.reports.spendByCategory(month, accountId);
  }

  /** `GET /reports/cash-flow?to=2026-09&months=12`: money in vs out, month by month. */
  @Get("cash-flow")
  cashFlow(@Query("to") to?: string, @Query("months") months?: string): Promise<CashFlowReport> {
    if (!to || !MONTH.test(to)) throw new BadRequestException("to must be YYYY-MM");
    const count = months === undefined ? 12 : Number(months);
    if (!Number.isInteger(count) || count < 1 || count > 36) {
      throw new BadRequestException("months must be 1–36");
    }
    return this.reports.cashFlow(to, count);
  }

  /**
   * Recounts `monthly_totals` from transactions. Reports how many rows had
   * drifted, so it doubles as a consistency check (0 = the totals were right).
   */
  @Post("monthly-totals/rebuild")
  rebuild(): Promise<RebuildResult> {
    return this.totals.rebuild();
  }
}
