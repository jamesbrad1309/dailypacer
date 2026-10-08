import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { NotificationsView } from "#components/notifications/NotificationsView";

const searchSchema = z.object({
  view: z.enum(["inbox", "unread", "saved", "done"]).catch("inbox").default("inbox"),
  reason: z.enum(["task", "money", "habit", "achievement"]).optional().catch(undefined),
});

export const Route = createFileRoute("/notifications")({
  staticData: { page: "notifications" },
  validateSearch: searchSchema,
  // `/notifications` means the inbox; don't spell it out in the URL.
  search: { middlewares: [stripSearchParams({ view: "inbox" })] },
  component: NotificationsPage,
});

function NotificationsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <NotificationsView
      search={search}
      onSearchChange={(next) => navigate({ search: (prev) => ({ ...prev, ...next }) })}
    />
  );
}
