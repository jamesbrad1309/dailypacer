import type { ApiPayeeRule, ApiSavingsGoal } from "#clients/api-types";
import type { GraphQLContext } from "#graphql/context";
import { queryString } from "#graphql/finance/query-string";

const goalPath = (id: string) => `/savings-goals/${encodeURIComponent(id)}`;
const rulePath = (id: string) => `/payee-rules/${encodeURIComponent(id)}`;

/**
 * Savings goals and payee rules: plain pass-through. Goal progress is
 * derived by the API on every read; `today` is the user's calendar day.
 */
export default {
  Query: {
    savingsGoals: (
      _: unknown,
      args: { today: string; includeArchived?: boolean },
      ctx: GraphQLContext,
    ) =>
      ctx.api.get<ApiSavingsGoal[]>(
        `/savings-goals${queryString({ today: args.today, includeArchived: args.includeArchived || null })}`,
      ),
    payeeRules: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.api.get<ApiPayeeRule[]>("/payee-rules"),
    payeeRuleMatchCount: async (_: unknown, args: { pattern: string }, ctx: GraphQLContext) =>
      (await ctx.api.get<{ count: number }>(`/payee-rules/match-count${queryString(args)}`)).count,
  },
  Mutation: {
    createSavingsGoal: (
      _: unknown,
      args: { input: Record<string, unknown>; today: string },
      ctx: GraphQLContext,
    ) => ctx.api.post<ApiSavingsGoal>("/savings-goals", { ...args.input, today: args.today }),
    updateSavingsGoal: (
      _: unknown,
      args: { id: string; input: Record<string, unknown>; today: string },
      ctx: GraphQLContext,
    ) => ctx.api.patch<ApiSavingsGoal>(goalPath(args.id), { ...args.input, today: args.today }),
    contributeToSavingsGoal: (
      _: unknown,
      args: { id: string; amountMinor: number; today: string },
      ctx: GraphQLContext,
    ) =>
      ctx.api.post<ApiSavingsGoal>(`${goalPath(args.id)}/contributions`, {
        amountMinor: args.amountMinor,
        today: args.today,
      }),
    deleteSavingsGoal: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.api.delete<unknown>(goalPath(args.id));
      return args.id;
    },
    createPayeeRule: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.post<ApiPayeeRule>("/payee-rules", args.input),
    updatePayeeRule: (_: unknown, args: { id: string; input: unknown }, ctx: GraphQLContext) =>
      ctx.api.patch<ApiPayeeRule>(rulePath(args.id), args.input),
    deletePayeeRule: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.api.delete<unknown>(rulePath(args.id));
      return args.id;
    },
    applyPayeeRules: async (_: unknown, __: unknown, ctx: GraphQLContext) =>
      (await ctx.api.post<{ categorised: number }>("/payee-rules/apply")).categorised,
  },
  SavingsGoal: {
    account: (g: ApiSavingsGoal, _: unknown, ctx: GraphQLContext) =>
      g.accountId ? ctx.loaders.accountById.load(g.accountId) : null,
    habitId: (g: ApiSavingsGoal) => (g.dailyHabitMinor === null ? null : g.habitId),
  },
  PayeeRule: {
    category: (r: ApiPayeeRule, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.categoryById.load(r.categoryId),
  },
};
