import { createFileRoute } from "@tanstack/react-router";
import { ListSkeleton } from "#components/layout/Skeletons";
import { TodayView } from "#components/todos/TodayView";
import { TODAY_TASKS_QUERY, TODO_LISTS_QUERY } from "#graphql/todos";
import { todayIsoDate } from "#lib/dates";

export const Route = createFileRoute("/tasks/")({
  staticData: { page: "tasksToday" },
  loader: async ({ context: { apolloClient } }) => {
    await Promise.all([
      apolloClient.query({ query: TODAY_TASKS_QUERY, variables: { today: todayIsoDate() } }),
      apolloClient.query({ query: TODO_LISTS_QUERY }),
    ]);
  },
  pendingComponent: ListSkeleton,
  component: TodayView,
});
