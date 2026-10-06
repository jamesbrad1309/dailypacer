import { Module } from "@nestjs/common";
import { AccountsController } from "#finance/accounts.controller";
import { AccountsService } from "#finance/accounts.service";
import { BudgetsController } from "#finance/budgets.controller";
import { BudgetsService } from "#finance/budgets.service";
import { CategoriesController } from "#finance/categories.controller";
import { CategoriesService } from "#finance/categories.service";
import { CsvUploadsController } from "#finance/csv-uploads.controller";
import { CsvUploadsService } from "#finance/csv-uploads.service";
import { CurrenciesController } from "#finance/currencies.controller";
import { CurrenciesService } from "#finance/currencies.service";
import { ExchangeRatesService } from "#finance/exchange-rates.service";
import { FinanceHabitsController } from "#finance/finance-habits.controller";
import { FinanceHabitsService } from "#finance/finance-habits.service";
import { ImportService } from "#finance/import.service";
import { LogosController } from "#finance/logos.controller";
import { LogosService } from "#finance/logos.service";
import { MonthlyTotalsService } from "#finance/monthly-totals.service";
import { PayeeRulesController } from "#finance/payee-rules.controller";
import { PayeeRulesService } from "#finance/payee-rules.service";
import { QuickLogController } from "#finance/quick-log.controller";
import { QuickLogService } from "#finance/quick-log.service";
import { ReportsController } from "#finance/reports.controller";
import { ReportsService } from "#finance/reports.service";
import { SavingsGoalsController } from "#finance/savings-goals.controller";
import { SavingsGoalsService } from "#finance/savings-goals.service";
import { SubscriptionsController } from "#finance/subscriptions.controller";
import { SubscriptionsService } from "#finance/subscriptions.service";
import { TransactionsController } from "#finance/transactions.controller";
import { TransactionsService } from "#finance/transactions.service";
import { HabitEntriesModule } from "#habit-entries/habit-entries.module";

/**
 * One module for all of finance: accounts, transactions, budgets and
 * reports are tightly coupled. Built so far (docs/finance/index.md): accounts
 * and reconciling (phase 1), transactions and quick log (phase 2), and spend
 * by category from the `monthly_totals` aggregate (phase 2b), budgets (phase 3),
 * and subscriptions with confirm-each-charge and cached logos. It also
 * keeps finance-linked habits ticked (FinanceHabitsService), so it imports
 * habit entries; habits never import finance.
 */
@Module({
  imports: [HabitEntriesModule],
  controllers: [
    AccountsController,
    CategoriesController,
    TransactionsController,
    QuickLogController,
    ReportsController,
    BudgetsController,
    CurrenciesController,
    CsvUploadsController,
    SubscriptionsController,
    LogosController,
    PayeeRulesController,
    SavingsGoalsController,
    FinanceHabitsController,
  ],
  providers: [
    AccountsService,
    CategoriesService,
    TransactionsService,
    QuickLogService,
    MonthlyTotalsService,
    ReportsService,
    BudgetsService,
    CurrenciesService,
    ExchangeRatesService,
    ImportService,
    CsvUploadsService,
    SubscriptionsService,
    LogosService,
    PayeeRulesService,
    SavingsGoalsService,
    FinanceHabitsService,
  ],
})
export class FinanceModule {}
