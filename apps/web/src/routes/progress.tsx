import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProgressView } from "#components/progress/ProgressView";
import { PERIODS, type Period } from "#lib/progress";

export const Route = createFileRoute("/progress")({
  staticData: { page: "progress" },
  validateSearch: z.object({
    weeks: z.coerce
      .number()
      .refine((n): n is Period => (PERIODS as readonly number[]).includes(n))
      .catch(12)
      .default(12),
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const { weeks } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ProgressView
      weeks={weeks as Period}
      onWeeksChange={(next) => navigate({ search: { weeks: next }, resetScroll: false })}
    />
  );
}
