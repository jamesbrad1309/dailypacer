import type { ApolloClient } from "@apollo/client";
import { createRouter } from "@tanstack/react-router";
import { PageSkeleton, RouteError } from "#components/RouteStatus";
import { apolloClient } from "#lib/apollo-client";
import { routeTree } from "./routeTree.gen";

/** Handed to every route's `loader`. */
export interface RouterContext {
  apolloClient: ApolloClient;
}

export const router = createRouter({
  routeTree,
  context: { apolloClient },
  defaultPreload: "intent",
  // Apollo owns caching (refetchQueries after mutations), as in apps/web.
  defaultPreloadStaleTime: 0,
  defaultPendingComponent: PageSkeleton,
  defaultErrorComponent: RouteError,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
