import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import {
  type ContributeInput,
  type CreateSavingsGoalInput,
  type UpdateSavingsGoalInput,
  contributeSchema,
  createSavingsGoalSchema,
  goalsQuerySchema,
  updateSavingsGoalSchema,
} from "#finance/dto/savings-goal.dto";
import { SavingsGoalsService } from "#finance/savings-goals.service";

/** Savings goals; `today` (the client's local day) drives progress and "on track". */
@Controller("savings-goals")
export class SavingsGoalsController {
  constructor(private readonly goals: SavingsGoalsService) {}

  /** `GET /savings-goals?today=2026-10-04[&includeArchived=true]` */
  @Get()
  list(
    @Query(new ZodValidationPipe(goalsQuerySchema))
    query: { today: string; includeArchived: boolean },
  ) {
    return this.goals.list(query.today, query.includeArchived);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createSavingsGoalSchema)) input: CreateSavingsGoalInput) {
    return this.goals.create(input);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSavingsGoalSchema)) input: UpdateSavingsGoalInput,
  ) {
    return this.goals.update(id, input);
  }

  /** Unlinked goals: add (or, negative, take out) money. */
  @Post(":id/contributions")
  contribute(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(contributeSchema)) input: ContributeInput,
  ) {
    return this.goals.contribute(id, input);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.goals.remove(id);
  }
}
