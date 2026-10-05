import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { JournalSearchView } from "#components/journal/JournalSearchView";

export const Route = createFileRoute("/journal/search")({
  staticData: { page: "journalSearch" },
  validateSearch: z.object({
    // Coerced: the router JSON-parses search values, so "?q=12" arrives as a number.
    q: z.coerce.string().max(100).optional().catch(undefined),
    tag: z.string().max(60).optional().catch(undefined),
    kind: z.enum(["ACTION", "FEELING", "EVENT"]).optional().catch(undefined),
  }),
  component: JournalSearchPage,
});

function JournalSearchPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <JournalSearchView
      search={search}
      onSearchChange={(next) =>
        navigate({ search: (prev) => ({ ...prev, ...next }), replace: true })
      }
    />
  );
}
