import { GraphQLError } from "graphql";
import type { ApiHabit, ApiHabitRecordsPage } from "#clients/api-types";
import type { GraphQLContext } from "#graphql/context";

const habitPath = (id: string) => `/habits/${encodeURIComponent(id)}`;

type HabitInput = Record<string, unknown> & {
  polarity?: string | null;
  metadata?: Record<string, unknown> | null;
  financeSource?: keyof typeof FINANCE_SOURCES | null;
  financeCategoryIds?: string[] | null;
};

/** The GraphQL enum as the `metadata.source` the API's finance module reads. */
const FINANCE_SOURCES = {
  NO_SPEND: "finance.noSpend",
  LOGGED_TODAY: "finance.loggedToday",
  SAVINGS_GOAL: "finance.savingsGoal",
} as const;

const financeSourceOf = (habit: ApiHabit) =>
  (Object.keys(FINANCE_SOURCES) as (keyof typeof FINANCE_SOURCES)[]).find(
    (key) => FINANCE_SOURCES[key] === habit.metadata?.source,
  ) ?? null;

/**
 * The GraphQL enum (BUILD/AVOID) as the API's "build"/"avoid", and a
 * finance link as metadata. A no-spend habit is always an avoid habit:
 * its days are clean unless money went out.
 */
function toApiHabitInput({ polarity, financeSource, financeCategoryIds, ...input }: HabitInput) {
  if (financeSource === "SAVINGS_GOAL") {
    throw new GraphQLError("A savings habit is started from its goal (dailyHabitMinor)", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  // Any habit can link spending categories (its cost); a no-spend habit also counts only them.
  if (financeCategoryIds?.length) {
    input.metadata = { ...input.metadata, categoryIds: financeCategoryIds };
  }
  if (financeSource) {
    input.metadata = { ...input.metadata, source: FINANCE_SOURCES[financeSource] };
    if (financeSource === "NO_SPEND") polarity = "AVOID";
  }
  return polarity ? { ...input, polarity: polarity.toLowerCase() } : input;
}

const recompute = (ctx: GraphQLContext, habitId: string) =>
  ctx.api.post<{ days: number }>(`/finance/habits/${encodeURIComponent(habitId)}/recompute`);

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
    habitSpend: (_: unknown, args: { today: string }, ctx: GraphQLContext) =>
      ctx.api.get<unknown[]>(`/finance/habits/spend?today=${encodeURIComponent(args.today)}`),
    habitInsights: (_: unknown, args: { habitId: string; today: string }, ctx: GraphQLContext) =>
      ctx.api.get<unknown>(
        `${habitPath(args.habitId)}/insights?today=${encodeURIComponent(args.today)}`,
      ),
  },
  Mutation: {
    /** A finance-linked habit starts with its past days already worked out. */
    createHabit: async (_: unknown, args: { input: HabitInput }, ctx: GraphQLContext) => {
      const habit = await ctx.api.post<ApiHabit>("/habits", toApiHabitInput(args.input));
      if (!args.input.financeSource) return habit;
      await recompute(ctx, habit.id);
      return habit;
    },
    recomputeDerivedHabitEntries: async (
      _: unknown,
      args: { habitId: string },
      ctx: GraphQLContext,
    ) => {
      await recompute(ctx, args.habitId);
      return ctx.api.get<ApiHabit>(habitPath(args.habitId));
    },
    /** New no-spend categories change which days were clean, so they're worked out again. */
    updateHabit: async (
      _: unknown,
      args: { id: string; input: HabitInput },
      ctx: GraphQLContext,
    ) => {
      const { financeCategoryIds, ...input } = args.input;
      const habit = await ctx.api.patch<ApiHabit>(habitPath(args.id), {
        ...toApiHabitInput(input),
        ...(financeCategoryIds && { financeCategoryIds }),
      });
      if (!financeCategoryIds || !financeSourceOf(habit)) return habit;
      await recompute(ctx, habit.id);
      return habit;
    },
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
    financeSource: financeSourceOf,
    savingsGoalId: (habit: ApiHabit) =>
      typeof habit.metadata?.goalId === "string" ? habit.metadata.goalId : null,
    financeCategoryIds: (habit: ApiHabit) =>
      Array.isArray(habit.metadata?.categoryIds) ? habit.metadata.categoryIds : [],
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
