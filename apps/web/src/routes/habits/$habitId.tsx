import { createFileRoute } from "@tanstack/react-router";
import { HabitDetail } from "#components/HabitDetail";
import { RECORDS_PAGE_SIZE } from "#components/HabitRecordsTable";
import { HabitDetailSkeleton } from "#components/layout/Skeletons";
import { HABIT_DETAIL_QUERY, HABIT_RECORDS_QUERY } from "#graphql/habits";
import { todayIsoDate } from "#lib/dates";

export const Route = createFileRoute("/habits/$habitId")({
  staticData: { page: "habitDetail" },
  loader: async ({ context: { apolloClient }, params }) => {
    await Promise.all([
      apolloClient.query({ query: HABIT_DETAIL_QUERY, variables: { id: params.habitId } }),
      // The records table's first page, with the variables it starts with.
      apolloClient.query({
        query: HABIT_RECORDS_QUERY,
        variables: {
          habitId: params.habitId,
          today: todayIsoDate(),
          filter: "ALL",
          page: 1,
          pageSize: RECORDS_PAGE_SIZE,
        },
      }),
    ]);
  },
  pendingComponent: HabitDetailSkeleton,
  component: HabitDetailPage,
});

function HabitDetailPage() {
  const { habitId } = Route.useParams();
  return <HabitDetail habitId={habitId} />;
}
