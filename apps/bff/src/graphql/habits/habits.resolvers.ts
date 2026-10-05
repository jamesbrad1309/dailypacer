import type { ApiHabit, ApiHabitRecordsPage } from "#clients/api-types";
import type { GraphQLContext } from "#graphql/context";

const habitPath = (id: string) => `/habits/${encodeURIComponent(id)}`;

type HabitInput = Record<string, unknown> & { polarity?: string | null };

/** The GraphQL enum (BUILD/AVOID) as the API's "build"/"avoid". */
function toApiHabitInput({ polarity, ...input }: HabitInput) {
  return polarity ? { ...input, polarity: polarity.toLowerCase() } : input;
}

/**
 * Pure mapping from GraphQL operations to REST calls. Validation, streaks and
 * points are the API's job. This layer shapes and batches. Stats fields share
 * one batched `habitStats` load per request, however many fields a query asks for.
 */
export default {
  Query: {
    habits: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.api.get<ApiHabit[]>("/habits"),
    archivedHabits: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.api.get<ApiHabit[]>("/habits?archived=true"),
    todayHabits: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.api.get<ApiHabit[]>("/habits/today"),
    habit: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      ctx.api.get<ApiHabit>(habitPath(args.id)),
    habitRecords: (
      _: unknown,
      args: { habitId: string; today: string; filter: string; page: number; pageSize: number },
      ctx: GraphQLContext,
    ) => {
      const query = new URLSearchParams({
        today: args.today,
        filter: args.filter,
        page: String(args.page),
        pageSize: String(args.pageSize),
      });
      return ctx.api.get<ApiHabitRecordsPage>(`${habitPath(args.habitId)}/records?${query}`);
    },
    habitInsights: (_: unknown, args: { habitId: string; today: string }, ctx: GraphQLContext) =>
      ctx.api.get<unknown>(
        `${habitPath(args.habitId)}/insights?today=${encodeURIComponent(args.today)}`,
      ),
  },
  Mutation: {
    createHabit: (_: unknown, args: { input: HabitInput }, ctx: GraphQLContext) =>
      ctx.api.post<ApiHabit>("/habits", toApiHabitInput(args.input)),
    updateHabit: (_: unknown, args: { id: string; input: HabitInput }, ctx: GraphQLContext) =>
      ctx.api.patch<ApiHabit>(habitPath(args.id), toApiHabitInput(args.input)),
    archiveHabit: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      ctx.api.post<ApiHabit>(`${habitPath(args.id)}/archive`),
    unarchiveHabit: (_: unknown, args: { id: string }, ctx: GraphQLContext) =>
      ctx.api.post<ApiHabit>(`${habitPath(args.id)}/unarchive`),
    pauseHabit: (_: unknown, args: { id: string; date?: string }, ctx: GraphQLContext) =>
      ctx.api.post<ApiHabit>(`${habitPath(args.id)}/pause`, { date: args.date ?? undefined }),
    resumeHabit: (_: unknown, args: { id: string; date?: string }, ctx: GraphQLContext) =>
      ctx.api.post<ApiHabit>(`${habitPath(args.id)}/resume`, { date: args.date ?? undefined }),
  },
  Habit: {
    polarity: (habit: ApiHabit) => habit.polarity.toUpperCase(),
    customFields: (habit: ApiHabit) => habit.metadata?.fields ?? [],
    todayEntry: (habit: ApiHabit, _: unknown, ctx: GraphQLContext) =>
      ctx.loaders.todayEntry.load(habit.id),
    paused: (habit: ApiHabit) => habit.pausedAt != null,

    currentStreak: async (habit: ApiHabit, _: unknown, ctx: GraphQLContext) =>
      (await ctx.loaders.habitStats.load(habit.id)).currentStreak,
    longestStreak: async (habit: ApiHabit, _: unknown, ctx: GraphQLContext) =>
      (await ctx.loaders.habitStats.load(habit.id)).longestStreak,
    totalCompletions: async (habit: ApiHabit, _: unknown, ctx: GraphQLContext) =>
      (await ctx.loaders.habitStats.load(habit.id)).totalCompletions,
    points: async (habit: ApiHabit, _: unknown, ctx: GraphQLContext) =>
      (await ctx.loaders.habitStats.load(habit.id)).points,
    level: async (habit: ApiHabit, _: unknown, ctx: GraphQLContext) =>
      (await ctx.loaders.habitStats.load(habit.id)).level,
    levelTitle: async (habit: ApiHabit, _: unknown, ctx: GraphQLContext) =>
      (await ctx.loaders.habitStats.load(habit.id)).levelTitle,
    heatmap: async (habit: ApiHabit, _: unknown, ctx: GraphQLContext) =>
      (await ctx.loaders.habitStats.load(habit.id)).heatmap,
  },
};
