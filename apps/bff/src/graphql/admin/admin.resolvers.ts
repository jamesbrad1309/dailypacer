import type { ApiAdminOverview } from "#clients/api-types";
import type { GraphQLContext } from "#graphql/context";

export default {
  Query: {
    adminOverview: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.api.get<ApiAdminOverview>("/admin/overview"),
  },
};
