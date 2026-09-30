import type { ApiSubscription, ApiSubscriptionCharge, ApiTransaction } from "#clients/api-types";
import type { GraphQLContext } from "#graphql/context";
import { queryString } from "#graphql/finance/query-string";

const subscriptionPath = (id: string) => `/subscriptions/${encodeURIComponent(id)}`;
const withToday = (path: string, today: string) => `${path}${queryString({ today })}`;

/** Our own logo route (routes/logos.ts); the browser never calls a favicon service itself. */
export const logoUrl = (domain: string) => `/logos/${encodeURIComponent(domain)}`;

/** A charge list resolves `subscription` as of the day it was asked for. */
type Charge = ApiSubscriptionCharge & { today: string };
const withDay = (today: string) => (charges: ApiSubscriptionCharge[]) =>
  charges.map((c): Charge => ({ ...c, today }));

interface TodayArgs {
  id: string;
  today: string;
}

/**
 * Maps GraphQL onto the API's /subscriptions endpoints. Schedules, prices
 * and statuses are all worked out in the API; this only renames the
 * status enums and resolves the account, category and logo fields.
 */
export default {
  Query: {
    subscriptionServices: (_: unknown, args: { search?: string | null }, ctx: GraphQLContext) =>
      ctx.api.get<unknown>(`/subscriptions/services${queryString({ q: args.search })}`),
    subscriptions: (
      _: unknown,
      args: { today: string; includeEnded?: boolean },
      ctx: GraphQLContext,
    ) => ctx.api.get<ApiSubscription[]>(`/subscriptions${queryString(args)}`),
    subscription: (_: unknown, args: TodayArgs, ctx: GraphQLContext) =>
      ctx.api.get<ApiSubscription>(withToday(subscriptionPath(args.id), args.today)),
    subscriptionCharges: (
      _: unknown,
      args: { from: string; to: string; today: string },
      ctx: GraphQLContext,
    ) =>
      ctx.api
        .get<ApiSubscriptionCharge[]>(`/subscriptions/charges${queryString(args)}`)
        .then(withDay(args.today)),
    pendingSubscriptionCharges: (_: unknown, args: { today: string }, ctx: GraphQLContext) =>
      ctx.api
        .get<ApiSubscriptionCharge[]>(withToday("/subscriptions/pending", args.today))
        .then(withDay(args.today)),
    subscriptionSummary: (_: unknown, args: { today: string }, ctx: GraphQLContext) =>
      ctx.api.get<unknown>(withToday("/subscriptions/summary", args.today)),
  },
  Mutation: {
    createSubscription: (
      _: unknown,
      args: { input: Record<string, unknown>; today: string },
      ctx: GraphQLContext,
    ) => ctx.api.post<ApiSubscription>("/subscriptions", { ...args.input, today: args.today }),
    updateSubscription: (_: unknown, args: TodayArgs & { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.patch<ApiSubscription>(withToday(subscriptionPath(args.id), args.today), args.input),
    changeSubscriptionPrice: (
      _: unknown,
      args: TodayArgs & { amountMinor: number; effectiveFrom: string },
      ctx: GraphQLContext,
    ) =>
      ctx.api.post<ApiSubscription>(withToday(`${subscriptionPath(args.id)}/price`, args.today), {
        amountMinor: args.amountMinor,
        effectiveFrom: args.effectiveFrom,
      }),
    pauseSubscription: (_: unknown, args: TodayArgs, ctx: GraphQLContext) =>
      ctx.api.post<ApiSubscription>(withToday(`${subscriptionPath(args.id)}/pause`, args.today)),
    resumeSubscription: (_: unknown, args: TodayArgs, ctx: GraphQLContext) =>
      ctx.api.post<ApiSubscription>(withToday(`${subscriptionPath(args.id)}/resume`, args.today)),
    cancelSubscription: (_: unknown, args: TodayArgs & { endsOn: string }, ctx: GraphQLContext) =>
      ctx.api.post<ApiSubscription>(withToday(`${subscriptionPath(args.id)}/cancel`, args.today), {
        endsOn: args.endsOn,
      }),
    reactivateSubscription: (_: unknown, args: TodayArgs, ctx: GraphQLContext) =>
      ctx.api.post<ApiSubscription>(
        withToday(`${subscriptionPath(args.id)}/reactivate`, args.today),
      ),
    deleteSubscription: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.api.delete<unknown>(subscriptionPath(args.id));
      return true;
    },
    confirmSubscriptionCharge: (
      _: unknown,
      args: {
        subscriptionId: string;
        dueOn: string;
        amountMinor?: number | null;
        date?: string | null;
      },
      ctx: GraphQLContext,
    ) =>
      ctx.api.post<ApiTransaction>(`${subscriptionPath(args.subscriptionId)}/charges/confirm`, {
        dueOn: args.dueOn,
        amountMinor: args.amountMinor ?? undefined,
        date: args.date ?? undefined,
      }),
    skipSubscriptionCharge: async (
      _: unknown,
      args: { subscriptionId: string; dueOn: string },
      ctx: GraphQLContext,
    ) => {
      await ctx.api.post<unknown>(`${subscriptionPath(args.subscriptionId)}/charges/skip`, {
        dueOn: args.dueOn,
      });
      return true;
    },
    reopenSubscriptionCharge: async (
      _: unknown,
      args: { subscriptionId: string; dueOn: string },
      ctx: GraphQLContext,
    ) => {
      await ctx.api.post<unknown>(`${subscriptionPath(args.subscriptionId)}/charges/reopen`, {
        dueOn: args.dueOn,
      });
      return true;
    },
  },
  SubscriptionService: {
    logoUrl: (service: { domain: string }) => logoUrl(service.domain),
  },
  Subscription: {
    logoUrl: (sub: ApiSubscription) => (sub.domain ? logoUrl(sub.domain) : null),
    status: (sub: ApiSubscription) => sub.status.toUpperCase(),
    account: (sub: ApiSubscription, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.accountById.load(sub.accountId),
    category: (sub: ApiSubscription, _: unknown, ctx: GraphQLContext) =>
      sub.categoryId ? ctx.loaders.categoryById.load(sub.categoryId) : null,
  },
  SubscriptionCharge: {
    id: (c: Charge) => `${c.subscriptionId}:${c.dueOn}`,
    status: (c: Charge) => c.status.toUpperCase(),
    subscription: async (c: Charge, _: unknown, ctx: GraphQLContext) => {
      const sub = (await ctx.loaders.subscriptionsOn.load(c.today)).get(c.subscriptionId);
      if (!sub) throw new Error(`No subscription ${c.subscriptionId}`);
      return sub;
    },
  },
};
