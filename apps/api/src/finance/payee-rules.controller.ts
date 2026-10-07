import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import {
  type CreatePayeeRuleInput,
  createPayeeRuleSchema,
  type UpdatePayeeRuleInput,
  updatePayeeRuleSchema,
} from "#finance/dto/payee-rule.dto";
import { PayeeRulesService } from "#finance/payee-rules.service";

@Controller("payee-rules")
export class PayeeRulesController {
  constructor(private readonly rules: PayeeRulesService) {}

  /** In the order they're tried. */
  @Get()
  list() {
    return this.rules.list();
  }

  /** `GET /payee-rules/match-count?pattern=TESCO*`: how many in "To review" it would file. */
  @Get("match-count")
  async matchCount(@Query("pattern") pattern = "") {
    return { count: await this.rules.matchCount(pattern) };
  }

  @Post()
  create(@Body(new ZodValidationPipe(createPayeeRuleSchema)) input: CreatePayeeRuleInput) {
    return this.rules.create(input);
  }

  /** Files every uncategorised transaction a rule matches. */
  @Post("apply")
  apply() {
    return this.rules.apply();
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePayeeRuleSchema)) input: UpdatePayeeRuleInput,
  ) {
    return this.rules.update(id, input);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.rules.remove(id);
  }
}
