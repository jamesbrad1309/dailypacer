import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import type { CreateUserInput, UpdateUserInput } from "#auth/dto/auth.dto";
import { hashPassword } from "#auth/password";
import { type Decision, decide, permissionsOn, type Request } from "#auth/policy";
import { type AuthUser, SessionsService } from "#auth/sessions.service";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";

const log = scopedLogger("UsersService");

function enforce(decision: Decision): void {
  if (!decision.allowed) {
    throw new ForbiddenException({ message: decision.reason, reason: decision.code });
  }
}

/** Managing people, from the admin dashboard. Every change is checked against the policy. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
  ) {}

  private view(subject: AuthUser, user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      lastSignInAt: user.lastSignInAt,
      createdAt: user.createdAt,
      isSelf: user.id === subject.id,
      permissions: permissionsOn(subject, user),
    };
  }

  /** Pending sign-ups first (they're waiting on someone), then by name. */
  async list(subject: AuthUser) {
    const users = await this.prisma.user.findMany({ orderBy: [{ name: "asc" }, { email: "asc" }] });
    const pendingFirst = [...users].sort(
      (a, b) => Number(b.status === "PENDING") - Number(a.status === "PENDING"),
    );
    return pendingFirst.map((user) => this.view(subject, user));
  }

  async create(subject: AuthUser, input: CreateUserInput) {
    enforce(decide(subject, { action: "users:create", role: input.role }));
    if (await this.prisma.user.findUnique({ where: { email: input.email } })) {
      throw new ConflictException({
        message: "There's already an account with that email.",
        reason: "EMAIL_TAKEN",
      });
    }
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        role: input.role,
        status: "ACTIVE",
      },
    });
    log.info({ by: subject.id, userId: user.id, role: user.role }, "user created");
    return this.view(subject, user);
  }

  async update(subject: AuthUser, id: string, input: UpdateUserInput) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException(`User ${id} not found`);
    const checks: Request[] = [];
    if (input.name !== undefined) checks.push({ action: "user:update", target });
    if (input.role !== undefined && input.role !== target.role) {
      checks.push({ action: "user:change-role", target, role: input.role });
    }
    if (input.status !== undefined && input.status !== target.status) {
      checks.push({ action: "user:change-status", target, status: input.status });
    }
    for (const check of checks) enforce(decide(subject, check));

    const user = await this.prisma.user.update({ where: { id }, data: input });
    // A disabled user is signed out everywhere; any other change refreshes their sessions.
    if (user.status !== "ACTIVE") await this.sessions.endAllFor(id);
    else this.sessions.forget(id);
    log.info({ by: subject.id, userId: id, changes: Object.keys(input) }, "user updated");
    return this.view(subject, user);
  }

  /** An admin's reset: signs the user out everywhere. */
  async resetPassword(subject: AuthUser, id: string, password: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException(`User ${id} not found`);
    enforce(decide(subject, { action: "user:reset-password", target }));
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await hashPassword(password) },
    });
    await this.sessions.endAllFor(id);
    log.info({ by: subject.id, userId: id }, "password reset");
  }
}
