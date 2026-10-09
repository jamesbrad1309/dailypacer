import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { AuthService, describeMe } from "#auth/auth.service";
import { Authorize, CurrentUser, Public, SessionToken } from "#auth/decorators";
import {
  type ChangePasswordInput,
  changePasswordSchema,
  type SignInInput,
  type SignUpInput,
  signInSchema,
  signUpSchema,
} from "#auth/dto/auth.dto";
import { type OnboardingInput, onboardingSchema } from "#auth/onboarding";
import { type AuthUser, SessionsService } from "#auth/sessions.service";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  /** `POST /auth/sign-in { email, password }` → `{ token, expiresAt, user }`. */
  @Public()
  @Post("sign-in")
  @HttpCode(200)
  signIn(@Body(new ZodValidationPipe(signInSchema)) input: SignInInput) {
    return this.auth.signIn(input);
  }

  /** `POST /auth/sign-up { email, name, password }` → `{ user, session }`: signed straight in. */
  @Public()
  @Post("sign-up")
  signUp(@Body(new ZodValidationPipe(signUpSchema)) input: SignUpInput) {
    return this.auth.signUp(input);
  }

  /** `GET /auth/me`: the signed-in user and what they may do. */
  @Authorize("app:read")
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return describeMe(user);
  }

  @Authorize("app:read")
  @Post("sign-out")
  @HttpCode(204)
  async signOut(@SessionToken() token: string) {
    await this.sessions.end(token);
  }

  @Authorize("self:change-password")
  @Post("password")
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @SessionToken() token: string,
    @Body(new ZodValidationPipe(changePasswordSchema)) input: ChangePasswordInput,
  ) {
    await this.auth.changePassword(user, token, input);
  }

  /** `POST /auth/onboarding { step }` saves progress; `{ done: true }` finishes. Returns `me`. */
  @Authorize("self:update")
  @Post("onboarding")
  @HttpCode(200)
  updateOnboarding(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(onboardingSchema)) input: OnboardingInput,
  ) {
    return this.auth.updateOnboarding(user, input);
  }
}
