import { BadRequestException, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { FinanceHabitsService } from "#finance/finance-habits.service";
import { LifeLevelService } from "#finance/life-level.service";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function requireDay(today: string | undefined): string {
  if (!today || !ISO_DATE.test(today)) throw new BadRequestException("today must be YYYY-MM-DD");
  return today;
}

/** Habits whose entries come from transactions (finance-habits.util.ts). */
@Controller("finance/habits")
export class FinanceHabitsController {
  constructor(private readonly financeHabits: FinanceHabitsService) {}

  /** `GET /finance/habits/spend?today=2026-10-06`: what each linked habit costs this month and last. */
  @Get("spend")
  spend(@Query("today") today?: string) {
    return this.financeHabits.spend(requireDay(today));
  }

  /** Rebuilds a linked habit's entries from the transactions: on creation, or to repair one. */
  @Post(":habitId/recompute")
  recompute(@Param("habitId") habitId: string) {
    return this.financeHabits.recompute(habitId);
  }
}

/** `GET /life-level?today=2026-10-06`: habit points plus finance XP (life-xp.util.ts). */
@Controller("life-level")
export class LifeLevelController {
  constructor(private readonly lifeLevel: LifeLevelService) {}

  @Get()
  level(@Query("today") today?: string) {
    return this.lifeLevel.level(requireDay(today));
  }
}
