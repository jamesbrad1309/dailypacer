import { createFileRoute } from "@tanstack/react-router";
import { JournalInsightsView } from "#components/journal/JournalInsightsView";

export const Route = createFileRoute("/journal/insights")({
  staticData: { page: "journalInsights" },
  component: JournalInsightsView,
});
