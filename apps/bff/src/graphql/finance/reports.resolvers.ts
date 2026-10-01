import type { GraphQLContext } from "#graphql/context";
import { queryString } from "#graphql/finance/query-string";

/** The API embeds each row's category, so this passes straight through. */
export default {
  Query: {
    spendByCategory: (
      _: unknown,
      args: { month: string; accountId?: string | null },
      ctx: GraphQLContext,
    ) => ctx.api.get<unknown>(`/reports/spend-by-category${queryString(args)}`),
    cashFlow: (_: unknown, args: { to: string; months?: number }, ctx: GraphQLContext) =>
      ctx.api.get<unknown>(`/reports/cash-flow${queryString(args)}`),
  },
};
