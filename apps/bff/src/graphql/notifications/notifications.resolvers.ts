import { scopedLogger } from "#common/logger/logger";
import type { GraphQLContext } from "#graphql/context";
import { queryString } from "#graphql/finance/query-string";

const log = scopedLogger("notifications");

type Reason = "TASK" | "MONEY" | "HABIT" | "ACHIEVEMENT";
type ApiReason = "task" | "money" | "habit" | "achievement";
interface Clock {
  today: string;
  time: string;
}

interface ApiNotification {
  id: string;
  kind: string;
  reason: ApiReason;
  params: unknown;
  link: string | null;
  surfacedAt: string;
  readAt: string | null;
  doneAt: string | null;
  savedAt: string | null;
}

interface ApiCounts {
  inbox: number;
  unread: number;
  unreadByReason: Record<ApiReason, number>;
}

const apiReason = (reason?: Reason | null) => (reason ? reason.toLowerCase() : null);

/**
 * Brings the inbox up to date before a read. A failed sync still lets the
 * stored notifications through: a stale inbox beats an error.
 */
async function sync(ctx: GraphQLContext, clock?: Clock | null) {
  if (!clock) return;
  try {
    await ctx.api.post("/notifications/sync", clock);
  } catch (err) {
    log.warn({ err }, "notification sync failed; serving what's stored");
  }
}

export default {
  Query: {
    notifications: async (
      _: unknown,
      args: {
        view?: string | null;
        reason?: Reason | null;
        first?: number | null;
        after?: string | null;
        clock?: Clock | null;
      },
      ctx: GraphQLContext,
    ) => {
      await sync(ctx, args.clock);
      return ctx.api.get<{ items: ApiNotification[]; nextCursor: string | null }>(
        `/notifications${queryString({
          view: args.view?.toLowerCase(),
          reason: apiReason(args.reason),
          first: args.first,
          after: args.after,
        })}`,
      );
    },
    notificationCounts: async (_: unknown, args: { clock?: Clock | null }, ctx: GraphQLContext) => {
      await sync(ctx, args.clock);
      const counts = await ctx.api.get<ApiCounts>("/notifications/counts");
      return { inbox: counts.inbox, unread: counts.unread, ...counts.unreadByReason };
    },
  },
  Mutation: {
    markNotifications: (
      _: unknown,
      args: { ids: string[]; read?: boolean | null; done?: boolean | null; saved?: boolean | null },
      ctx: GraphQLContext,
    ) =>
      ctx.api.post<ApiNotification[]>("/notifications/mark", {
        ids: args.ids,
        read: args.read ?? undefined,
        done: args.done ?? undefined,
        saved: args.saved ?? undefined,
      }),
    markAllNotificationsRead: async (
      _: unknown,
      args: { reason?: Reason | null },
      ctx: GraphQLContext,
    ) =>
      (
        await ctx.api.post<{ count: number }>("/notifications/read-all", {
          reason: apiReason(args.reason) ?? undefined,
        })
      ).count,
  },
  Notification: {
    reason: (n: ApiNotification) => n.reason.toUpperCase(),
    unread: (n: ApiNotification) => n.readAt === null,
    done: (n: ApiNotification) => n.doneAt !== null,
    saved: (n: ApiNotification) => n.savedAt !== null,
  },
};
