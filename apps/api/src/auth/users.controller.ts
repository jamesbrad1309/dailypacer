import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { Authorize, CurrentUser } from "#auth/decorators";
import {
  type CreateUserInput,
  createUserSchema,
  type ResetPasswordInput,
  resetPasswordSchema,
  type UpdateUserInput,
  updateUserSchema,
} from "#auth/dto/auth.dto";
import type { AuthUser } from "#auth/sessions.service";
import { UsersService } from "#auth/users.service";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";

/** People, managed from the admin dashboard. The guard lets owners and admins in; UsersService decides each change. */
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Authorize("users:list")
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.users.list(user);
  }

  @Authorize("users:create")
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createUserSchema)) input: CreateUserInput,
  ) {
    return this.users.create(user, input);
  }

  @Authorize("user:update")
  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) input: UpdateUserInput,
  ) {
    return this.users.update(user, id, input);
  }

  @Authorize("user:reset-password")
  @Post(":id/password")
  @HttpCode(204)
  async resetPassword(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(resetPasswordSchema)) input: ResetPasswordInput,
  ) {
    await this.users.resetPassword(user, id, input.password);
  }
}
