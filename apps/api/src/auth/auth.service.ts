import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  type OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ChangePasswordInput, SignInInput, SignUpInput } from "#auth/dto/auth.dto";
import { emailSchema, passwordSchema } from "#auth/dto/auth.dto";
import { DUMMY_HASH, hashPassword, verifyPassword } from "#auth/password";
import { abilitiesOf } from "#auth/policy";
import { type AuthUser, SessionsService, toAuthUser } from "#auth/sessions.service";
import { SignInThrottle } from "#auth/sign-in-throttle";
import type { Env } from "#common/config/env";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";

const log = scopedLogger("AuthService");

const WRONG_CREDENTIALS = "That email and password don't match.";

/** What clients get about the signed-in user: who they are and what they may do. */
export function describeMe(user: AuthUser) {
  return { ...user, abilities: abilitiesOf(user) };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly throttle = new SignInThrottle();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * First run: with OWNER_EMAIL and OWNER_PASSWORD set and no owner yet,
   * create that owner, so a fresh deployment can be signed into.
   */
  async onModuleInit() {
    const email = this.config.get("OWNER_EMAIL", { infer: true });
    const password = this.config.get("OWNER_PASSWORD", { infer: true });
    if (!email || !password) return;
    if (await this.prisma.user.count({ where: { role: "OWNER" } })) return;
    const parsedEmail = emailSchema.safeParse(email);
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedEmail.success || !parsedPassword.success) {
      log.error("OWNER_EMAIL or OWNER_PASSWORD is invalid; no owner created");
      return;
    }
    await this.prisma.user.upsert({
      where: { email: parsedEmail.data },
      update: { role: "OWNER", status: "ACTIVE" },
      create: {
        email: parsedEmail.data,
        name: this.config.get("OWNER_NAME", { infer: true }) ?? "Owner",
        passwordHash: await hashPassword(parsedPassword.data),
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    log.info({ email: parsedEmail.data }, "owner created from OWNER_EMAIL");
  }

  async signIn(input: SignInInput) {
    const wait = this.throttle.retryAfter(input.email);
    if (wait > 0) {
      throw new HttpException(
        {
          message: `Too many attempts. Try again in ${Math.ceil(wait / 60_000)} minutes.`,
          reason: "TOO_MANY_ATTEMPTS",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Hash even when there's no such user, so timing doesn't reveal which emails exist.
    const ok = await verifyPassword(input.password, user?.passwordHash ?? (await DUMMY_HASH));
    if (!user || !ok) {
      this.throttle.fail(input.email);
      log.warn({ email: input.email }, "sign-in failed");
      throw new UnauthorizedException({ message: WRONG_CREDENTIALS, reason: "WRONG_CREDENTIALS" });
    }
    this.throttle.succeed(input.email);
    // Only after the password checks out, so this doesn't reveal the account to a guesser.
    if (user.status === "PENDING") {
      throw new ForbiddenException({
        message: "Your account is waiting for an admin to approve it.",
        reason: "ACCOUNT_PENDING",
      });
    }
    if (user.status === "DISABLED") {
      throw new ForbiddenException({
        message: "Your account has been turned off. Ask an admin.",
        reason: "ACCOUNT_DISABLED",
      });
    }
    const session = await this.sessions.create(user.id, input.userAgent);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastSignInAt: new Date() } });
    log.info({ userId: user.id }, "signed in");
    return { ...session, user: describeMe(toAuthUser(user)) };
  }

  /**
   * Anyone can sign up; the account waits for an admin's approval (it would
   * otherwise see everyone's shared data). Exception: the very first user of
   * an empty database becomes its owner, signed straight in.
   */
  async signUp(input: SignUpInput) {
    const passwordHash = await hashPassword(input.password);
    const created = await this.prisma.$transaction(async (tx) => {
      if (await tx.user.findUnique({ where: { email: input.email } })) {
        throw new ConflictException({
          message: "There's already an account with that email. Sign in instead.",
          reason: "EMAIL_TAKEN",
        });
      }
      const first = (await tx.user.count()) === 0;
      return tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
          role: first ? "OWNER" : "VIEWER",
          status: first ? "ACTIVE" : "PENDING",
        },
      });
    });
    log.info({ userId: created.id, role: created.role, status: created.status }, "signed up");
    if (created.status !== "ACTIVE")
      return { user: describeMe(toAuthUser(created)), session: null };
    const session = await this.sessions.create(created.id, input.userAgent);
    return { user: describeMe(toAuthUser(created)), session };
  }

  /** Keeps this session, ends every other one. */
  async changePassword(user: AuthUser, token: string, input: ChangePasswordInput): Promise<void> {
    const stored = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(input.currentPassword, stored.passwordHash))) {
      throw new HttpException(
        {
          message: "Your current password isn't right.",
          reason: "WRONG_PASSWORD",
          issues: [{ path: ["currentPassword"], message: "Your current password isn't right." }],
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    await this.sessions.endAllFor(user.id, token);
    log.info({ userId: user.id }, "password changed");
  }
}
