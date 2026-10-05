import { createFileRoute } from "@tanstack/react-router";
import { RewardsView } from "#components/RewardsView";

export const Route = createFileRoute("/habits/rewards")({
  staticData: { page: "habitRewards" },
  component: RewardsView,
});
