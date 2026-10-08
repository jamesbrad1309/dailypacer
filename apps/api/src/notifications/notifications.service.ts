import { BadRequestException, Injectable } from "@nestjs/common";
import type { Notification, Prisma } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { scopedLogger } from "#common/logger/logger";
import type {
  ListNotificationsInput,
  MarkNotificationsInput,
  ReadAllInput,
  SyncNotificationsInput,
} from "#notifications/dto/notification.dto";
import {
  type NotificationReason,
  planSync,
  REASONS,
  reasonOf,
} from "#notifications/notification.util";
import { NotificationSourcesService } from "#notifications/notification-sources.service";

const log = scopedLogger("NotificationsService");

/** Syncs closer together than this (the bell polls) reuse the last one, unless the day changed. */
const SYNC_EVERY_MS = 30_000;
/** Done notifications are kept this long, then deleted (saved ones stay). */
const KEEP_DONE_DAYS = 90;

export interface NotificationDto {
  id: string;
  kind: string;
  reason: NotificationReason;
  params: unknown;
  link: string | null;
  surfacedAt: string;
  readAt: string | null;
  doneAt: string | null;
  savedAt: string | null;
}

const toDto = (n: Notification): NotificationDto => ({
  id: n.id,
  kind: n.kind,
  reason: reasonOf(n.kind),
  params: n.params,
  link: n.link,
  surfacedAt: n.surfacedAt.toISOString(),
  readAt: n.readAt?.toISOString() ?? null,
  doneAt: n.doneAt?.toISOString() ?? null,
  savedAt: n.savedAt?.toISOString() ?? null,
});

const ofReason = (reason: NotificationReason | undefined): Prisma.NotificationWhereInput =>
  reason ? { kind: { startsWith: `${reason}.` } } : {};

const VIEWS: Record<ListNotificationsInput["view"], Prisma.NotificationWhereInput> = {
  inbox: { doneAt: null },
  unread: { doneAt: null, readAt: null },
  saved: { savedAt: { not: null } },
  done: { doneAt: { not: null } },
};

const ORDER: Prisma.NotificationOrderByWithRelationInput[] = [
  { surfacedAt: "desc" },
  { id: "desc" },
];

const encodeCursor = (n: Notification) =>
  Buffer.from(`${n.surfacedAt.toISOString()}|${n.id}`).toString("base64url");

function afterCursor(cursor: string): Prisma.NotificationWhereInput {
  const [at, id] = Buffer.from(cursor, "base64url").toString().split("|");
  const surfacedAt = new Date(at);
  if (!id || Number.isNaN(surfacedAt.getTime())) throw new BadRequestException("bad cursor");
  return { OR: [{ surfacedAt: { lt: surfacedAt } }, { surfacedAt, id: { lt: id } }] };
}

/**
 * The inbox (docs/backend/notifications.md). `sync` turns what's true now
 * into notifications; the rest reads them and marks them read, done or saved.
 */
@Injectable()
export class NotificationsService {
  private lastSync: { today: string; at: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sources: NotificationSourcesService,
  ) {}

  async sync(clock: SyncNotificationsInput): Promise<{ created: number; resolved: number }> {
    const now = Date.now();
    if (this.lastSync?.today === clock.today && now - this.lastSync.at < SYNC_EVERY_MS) {
      return { created: 0, resolved: 0 };
    }
    this.lastSync = { today: clock.today, at: now };

    const { candidates, covered } = await this.sources.collect(clock);
    const keys = candidates.map((c) => c.key);
    const existing = await this.prisma.notification.findMany({
      where: {
        OR: [{ key: { in: keys } }, { doneAt: null, kind: { in: [...covered] } }],
      },
    });
    const plan = planSync(existing, candidates, covered);
    const at = new Date(now);

    await this.prisma.$transaction([
      this.prisma.notification.createMany({
        data: plan.create.map((c) => ({
          key: c.key,
          kind: c.kind,
          params: c.params as Prisma.InputJsonValue,
          link: c.link,
          fingerprint: c.fingerprint,
          surfacedAt: at,
        })),
        // Two syncs racing (two tabs) make each one once.
        skipDuplicates: true,
      }),
      ...plan.update.map(({ id, candidate, resurface }) =>
        this.prisma.notification.update({
          where: { id },
          data: {
            kind: candidate.kind,
            params: candidate.params as Prisma.InputJsonValue,
            link: candidate.link,
            fingerprint: candidate.fingerprint,
            ...(resurface && { surfacedAt: at, readAt: null, doneAt: null }),
          },
        }),
      ),
      this.prisma.notification.updateMany({
        where: { id: { in: plan.resolve } },
        data: { doneAt: at, readAt: at },
      }),
      this.prisma.notification.deleteMany({
        where: {
          doneAt: { lt: new Date(now - KEEP_DONE_DAYS * 86_400_000) },
          savedAt: null,
          // Still true: keep it, or the next sync would bring it back as new.
          key: { notIn: keys },
        },
      }),
    ]);

    if (plan.create.length || plan.resolve.length) {
      log.info(
        { created: plan.create.length, resurfaced: plan.update.filter((u) => u.resurface).length },
        "notifications synced",
      );
    }
    return { created: plan.create.length, resolved: plan.resolve.length };
  }

  async list(input: ListNotificationsInput) {
    const where: Prisma.NotificationWhereInput[] = [VIEWS[input.view], ofReason(input.reason)];
    if (input.after) where.push(afterCursor(input.after));
    const rows = await this.prisma.notification.findMany({
      where: { AND: where },
      orderBy: ORDER,
      take: input.first + 1,
    });
    const items = rows.slice(0, input.first);
    const hasMore = rows.length > input.first;
    return {
      items: items.map(toDto),
      nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null,
    };
  }

  /** Inbox totals for the bell and the filters: unread overall and per reason. */
  async counts() {
    const open = await this.prisma.notification.findMany({
      where: { doneAt: null },
      select: { kind: true, readAt: true },
    });
    const unreadByReason = Object.fromEntries(REASONS.map((r) => [r, 0])) as Record<
      NotificationReason,
      number
    >;
    for (const n of open) if (!n.readAt) unreadByReason[reasonOf(n.kind)] += 1;
    return {
      inbox: open.length,
      unread: open.filter((n) => !n.readAt).length,
      unreadByReason,
    };
  }

  async mark({ ids, read, done, saved }: MarkNotificationsInput) {
    const at = new Date();
    const data: Prisma.NotificationUpdateManyMutationInput = {};
    if (read !== undefined) data.readAt = read ? at : null;
    if (saved !== undefined) data.savedAt = saved ? at : null;
    if (done !== undefined) {
      data.doneAt = done ? at : null;
      // Done means seen, as on GitHub.
      if (done && read === undefined) data.readAt = at;
    }
    await this.prisma.notification.updateMany({ where: { id: { in: ids } }, data });
    const rows = await this.prisma.notification.findMany({ where: { id: { in: ids } } });
    return rows.map(toDto);
  }

  async readAll({ reason }: ReadAllInput) {
    const { count } = await this.prisma.notification.updateMany({
      where: { doneAt: null, readAt: null, ...ofReason(reason) },
      data: { readAt: new Date() },
    });
    return { count };
  }
}
