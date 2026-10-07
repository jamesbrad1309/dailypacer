import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { SubscriptionsView } from "#components/finance/subscriptions/SubscriptionsView";
import {
  PENDING_CHARGES_QUERY,
  SUBSCRIPTION_SUMMARY_QUERY,
  SUBSCRIPTIONS_QUERY,
} from "#graphql/subscriptions";
import { todayIsoDate } from "#lib/dates";

const searchSchema = z.object({
  tab: z.enum(["upcoming", "calendar", "all"]).catch("upcoming").default("upcoming"),
  /** The calendar's month. */
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/finance/subscriptions")({
  staticData: { page: "subscriptions" },
  validateSearch: searchSchema,
  // `/finance/subscriptions` means the Upcoming tab; don't spell it out in the URL.
  search: { middlewares: [stripSearchParams({ tab: "upcoming" })] },
  // Warms Apollo's cache; the page's own useQuery hooks read from it.
  loader: async ({ context: { apolloClient } }) => {
    const today = todayIsoDate();
    await Promise.all([
      apolloClient.query({ query: SUBSCRIPTION_SUMMARY_QUERY, variables: { today } }),
      apolloClient.query({ query: SUBSCRIPTIONS_QUERY, variables: { today, includeEnded: false } }),
      apolloClient.query({ query: PENDING_CHARGES_QUERY, variables: { today } }),
    ]);
  },
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  const { tab, month } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <SubscriptionsView
      tab={tab}
      month={month}
      onChange={(next) => navigate({ search: (prev) => ({ ...prev, ...next }) })}
    />
  );
}
