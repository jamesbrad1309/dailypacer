import { Controller, Param, Post } from "@nestjs/common";
import { FinanceHabitsService } from "#finance/finance-habits.service";

/** Habits whose entries come from transactions (finance-habits.util.ts). */
@Controller("finance/habits")
export class FinanceHabitsController {
  constructor(private readonly financeHabits: FinanceHabitsService) {}

  /** Rebuilds a linked habit's entries from the transactions: on creation, or to repair one. */
  @Post(":habitId/recompute")
  recompute(@Param("habitId") habitId: string) {
    return this.financeHabits.recompute(habitId);
  }
}
