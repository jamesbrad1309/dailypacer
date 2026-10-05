import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { WeeklyReviewView } from "#components/WeeklyReviewView";

export const Route = createFileRoute("/habits/review")({
  staticData: { page: "habitReview" },
  validateSearch: z.object({
    week: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .catch(undefined),
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { week } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <WeeklyReviewView
      weekStart={week}
      onWeekChange={(next) => navigate({ search: next ? { week: next } : {}, resetScroll: false })}
    />
  );
}
