import { createFileRoute } from "@tanstack/react-router";
import { HabitHistory } from "#components/HabitHistory";
import { HabitHistorySkeleton } from "#components/layout/Skeletons";
import { HABITS_QUERY } from "#graphql/habits";

export const Route = createFileRoute("/habits/history")({
  staticData: { page: "history" },
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({ query: HABITS_QUERY });
  },
  pendingComponent: HabitHistorySkeleton,
  component: HabitHistory,
});
