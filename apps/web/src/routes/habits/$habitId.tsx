import { createFileRoute } from "@tanstack/react-router";
import { HabitDetail } from "#components/HabitDetail";
import { HabitDetailSkeleton } from "#components/layout/Skeletons";
import { HABIT_DETAIL_QUERY } from "#graphql/habits";

export const Route = createFileRoute("/habits/$habitId")({
  staticData: { page: "habitDetail" },
  loader: async ({ context: { apolloClient }, params }) => {
    await apolloClient.query({ query: HABIT_DETAIL_QUERY, variables: { id: params.habitId } });
  },
  pendingComponent: HabitDetailSkeleton,
  component: HabitDetailPage,
});

function HabitDetailPage() {
  const { habitId } = Route.useParams();
  return <HabitDetail habitId={habitId} />;
}
