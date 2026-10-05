import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { HabitCalendarView } from "#components/HabitCalendarView";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const Route = createFileRoute("/habits/calendar")({
  staticData: { page: "habitCalendar" },
  validateSearch: z.object({
    view: z.enum(["week", "month"]).catch("week").default("week"),
    date: isoDate.optional().catch(undefined),
    day: isoDate.optional().catch(undefined),
  }),
  component: HabitCalendarPage,
});

function HabitCalendarPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <HabitCalendarView
      search={search}
      onSearchChange={(next) =>
        navigate({ search: (prev) => ({ ...prev, ...next }), resetScroll: false })
      }
    />
  );
}
