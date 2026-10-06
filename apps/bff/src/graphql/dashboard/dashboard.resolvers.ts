import type { ApiDashboardStats } from "#clients/api-types";
import type { GraphQLContext } from "#graphql/context";

export default {
  Query: {
    dashboardStats: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.api.get<ApiDashboardStats>("/dashboard/stats"),
    lifeLevel: (_: unknown, args: { today: string }, ctx: GraphQLContext) =>
      ctx.api.get<unknown>(`/life-level?today=${encodeURIComponent(args.today)}`),
  },
};
