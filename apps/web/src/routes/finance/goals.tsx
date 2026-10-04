import { createFileRoute } from "@tanstack/react-router";
import { GoalsView } from "#components/finance/goals/GoalsView";
import { SAVINGS_GOALS_QUERY } from "#graphql/finance";
import { todayIsoDate } from "#lib/dates";

export const Route = createFileRoute("/finance/goals")({
  staticData: { page: "goals" },
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({
      query: SAVINGS_GOALS_QUERY,
      variables: { today: todayIsoDate(), includeArchived: false },
    });
  },
  component: GoalsView,
});
