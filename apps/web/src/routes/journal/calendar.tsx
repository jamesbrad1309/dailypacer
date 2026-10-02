import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { JournalCalendar } from "#components/journal/JournalCalendar";
import { JournalCalendarSkeleton } from "#components/layout/Skeletons";
import { JOURNAL_DAYS_QUERY, JOURNAL_FIRST_DATE_QUERY } from "#graphql/journal";
import { currentMonth, monthGridRange } from "#lib/dates";

const searchSchema = z.object({
  // `/journal/calendar` is always this month; only earlier months go in the
  // URL. A malformed `?month=` falls back to this month rather than erroring.
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
});

/** The month to show: the requested one, unless it's missing or in the future. */
function shownMonth(requested: string | undefined): string {
  const thisMonth = currentMonth();
  return requested && requested < thisMonth ? requested : thisMonth;
}

export const Route = createFileRoute("/journal/calendar")({
  staticData: { page: "journalCalendar" },
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: async ({ context: { apolloClient }, deps }) => {
    await Promise.all([
      apolloClient.query({
        query: JOURNAL_DAYS_QUERY,
        variables: monthGridRange(shownMonth(deps.month)),
      }),
      apolloClient.query({ query: JOURNAL_FIRST_DATE_QUERY }),
    ]);
  },
  pendingComponent: JournalCalendarSkeleton,
  component: JournalCalendarPage,
});

function JournalCalendarPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const month = shownMonth(search.month);

  return (
    <JournalCalendar
      month={month}
      onMonthChange={(next) =>
        navigate({ search: next < currentMonth() ? { month: next } : {}, resetScroll: false })
      }
    />
  );
}
