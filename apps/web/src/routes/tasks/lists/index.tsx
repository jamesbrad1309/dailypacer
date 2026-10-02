import { createFileRoute } from "@tanstack/react-router";
import { ListSkeleton } from "#components/layout/Skeletons";
import { ListsView } from "#components/todos/ListsView";
import { TODO_LISTS_QUERY } from "#graphql/todos";

export const Route = createFileRoute("/tasks/lists/")({
  staticData: { page: "tasksLists" },
  loader: async ({ context: { apolloClient } }) => {
    await apolloClient.query({ query: TODO_LISTS_QUERY });
  },
  pendingComponent: ListSkeleton,
  component: ListsView,
});
