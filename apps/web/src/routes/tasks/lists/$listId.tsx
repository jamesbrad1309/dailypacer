import { createFileRoute } from "@tanstack/react-router";
import { ListSkeleton } from "#components/layout/Skeletons";
import { BoardView } from "#components/todos/BoardView";
import { LIST_BOARD_QUERY } from "#graphql/todos";

export const Route = createFileRoute("/tasks/lists/$listId")({
  staticData: { page: "taskBoard" },
  loader: async ({ context: { apolloClient }, params }) => {
    await apolloClient.query({
      query: LIST_BOARD_QUERY,
      variables: { listId: params.listId, doneLimit: 50 },
    });
  },
  pendingComponent: ListSkeleton,
  component: BoardPage,
});

function BoardPage() {
  const { listId } = Route.useParams();
  return <BoardView listId={listId} />;
}
