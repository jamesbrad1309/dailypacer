import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Role, Status } from "#auth/policy";
import { PrismaService } from "#common/database/prisma.service";

/** What a request knows about who's signed in. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: Status;
  /** Where they are in the set-up steps (onboarding.ts); `completedAt` null until finished. */
  onboarding: { step: string | null; completedAt: Date | null };
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** How often a session's lastSeenAt (and so its expiry) moves forward. */
const TOUCH_EVERY_MS = 60 * 60 * 1000;
/** How long a looked-up session is trusted before the database is asked again. */
const CACHE_MS = 30 * 1000;

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    onboarding: { step: user.onboardingStep, completedAt: user.onboardedAt },
  };
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Server-side sessions: the client holds a random token (in the BFF's
 * cookie), the database only its hash. Lookups are cached briefly because
 * one GraphQL request makes several API calls; sign-out, disabling a user
 * or changing their role drops the cache entries in this process.
 */
@Injectable()
export class SessionsService {
  private readonly cache = new Map<string, { user: AuthUser; until: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, userAgent?: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.session.create({
      data: { tokenHash: hashToken(token), userId, expiresAt, userAgent },
    });
    return { token, expiresAt };
  }

  /** The session's user, or null when the token is unknown or expired. */
  async authenticate(token: string): Promise<AuthUser | null> {
    const tokenHash = hashToken(token);
    const cached = this.cache.get(tokenHash);
    if (cached && cached.until > Date.now()) return cached.user;

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    const now = Date.now();
    if (!session || session.expiresAt.getTime() <= now) {
      this.cache.delete(tokenHash);
      if (session)
        await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }
    if (now - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) },
      });
    }
    const user = toAuthUser(session.user);
    this.cache.set(tokenHash, { user, until: now + CACHE_MS });
    return user;
  }

  async end(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    this.cache.delete(tokenHash);
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  /** Signs a user out everywhere, except optionally the session they're using. */
  async endAllFor(userId: string, keepToken?: string): Promise<void> {
    const keep = keepToken ? hashToken(keepToken) : undefined;
    await this.prisma.session.deleteMany({
      where: { userId, ...(keep ? { tokenHash: { not: keep } } : {}) },
    });
    this.forget(userId, keep);
  }

  /** Drops cached lookups for a user whose role, name or status changed. */
  forget(userId: string, exceptHash?: string): void {
    for (const [hash, entry] of this.cache) {
      if (entry.user.id === userId && hash !== exceptHash) this.cache.delete(hash);
    }
  }
}
