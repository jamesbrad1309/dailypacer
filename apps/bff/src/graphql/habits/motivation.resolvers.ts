import type { GraphQLContext } from "#graphql/context";
import { queryString } from "#graphql/finance/query-string";

const enc = encodeURIComponent;

/** Plain pass-through to the API's motivation and review endpoints. */
export default {
  Query: {
    habitCalendar: (
      _: unknown,
      args: { from: string; to: string; today: string },
      ctx: GraphQLContext,
    ) => ctx.api.get<unknown>(`/habit-calendar${queryString(args)}`),
    weeklyReview: (_: unknown, args: { weekStart: string; today: string }, ctx: GraphQLContext) =>
      ctx.api.get<unknown>(`/habit-review/weekly${queryString(args)}`),
    habitProgress: (_: unknown, args: { weeks: number; today: string }, ctx: GraphQLContext) =>
      ctx.api.get<unknown>(`/habit-review/progress${queryString(args)}`),
    achievements: (_: unknown, args: { today: string }, ctx: GraphQLContext) =>
      ctx.api.get<unknown>(`/habit-review/achievements${queryString(args)}`),
    habitCorrelations: (_: unknown, args: { today: string }, ctx: GraphQLContext) =>
      ctx.api.get<unknown>(`/habit-review/correlations${queryString(args)}`),
    pointsWallet: (_: unknown, args: { today: string }, ctx: GraphQLContext) =>
      ctx.api.get<unknown>(`/points${queryString(args)}`),
    rewards: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.api.get<unknown>("/rewards"),
    challenges: (_: unknown, args: { today: string }, ctx: GraphQLContext) =>
      ctx.api.get<unknown>(`/challenges${queryString(args)}`),
    routines: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.api.get<unknown>("/routines"),
  },
  Mutation: {
    createReward: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.post<unknown>("/rewards", args.input),
    updateReward: (_: unknown, args: { id: string; input: unknown }, ctx: GraphQLContext) =>
      ctx.api.patch<unknown>(`/rewards/${enc(args.id)}`, args.input),
    deleteReward: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.api.delete<unknown>(`/rewards/${enc(args.id)}`);
      return args.id;
    },
    redeemReward: (_: unknown, args: { id: string; today: string }, ctx: GraphQLContext) =>
      ctx.api.post<unknown>(`/rewards/${enc(args.id)}/redeem`, { today: args.today }),
    undoPointsSpend: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.api.delete<unknown>(`/points/spends/${enc(args.id)}`);
      return args.id;
    },
    freezeHabitDay: async (
      _: unknown,
      args: { habitId: string; date: string; today: string },
      ctx: GraphQLContext,
    ) => {
      await ctx.api.post<unknown>(`/habits/${enc(args.habitId)}/freezes`, {
        date: args.date,
        today: args.today,
      });
      return true;
    },
    unfreezeHabitDay: async (
      _: unknown,
      args: { habitId: string; date: string },
      ctx: GraphQLContext,
    ) => {
      await ctx.api.delete<unknown>(`/habits/${enc(args.habitId)}/freezes/${enc(args.date)}`);
      return true;
    },
    createChallenge: (
      _: unknown,
      args: { habitId: string; input: Record<string, unknown>; today: string },
      ctx: GraphQLContext,
    ) =>
      ctx.api.post<unknown>(`/habits/${enc(args.habitId)}/challenges`, {
        ...args.input,
        today: args.today,
      }),
    deleteChallenge: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.api.delete<unknown>(`/challenges/${enc(args.id)}`);
      return args.id;
    },
    createRoutine: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.post<unknown>("/routines", args.input),
    updateRoutine: (_: unknown, args: { id: string; input: unknown }, ctx: GraphQLContext) =>
      ctx.api.patch<unknown>(`/routines/${enc(args.id)}`, args.input),
    deleteRoutine: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.api.delete<unknown>(`/routines/${enc(args.id)}`);
      return args.id;
    },
  },
  Reward: {
    timesRedeemed: (r: { _count?: { spends: number } }) => r._count?.spends ?? 0,
  },
};
