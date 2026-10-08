import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

export const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: "/graphql" }),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // One cache entry per filter, not per page: "Load more" (a request
          // with `after`) appends to it, and a first page replaces it.
          transactions: {
            keyArgs: ["filter"],
            merge(existing, incoming, { args }) {
              if (!existing || !args?.after) return incoming;
              return { ...incoming, items: [...existing.items, ...incoming.items] };
            },
          },
          // One entry whatever the clock: the bell syncs with it, the sidebar reads the same counts.
          notificationCounts: { keyArgs: false },
          // The same for the inbox, per view and reason; `clock` only syncs first.
          notifications: {
            keyArgs: ["view", "reason"],
            merge(existing, incoming, { args }) {
              if (!existing || !args?.after) return incoming;
              return { ...incoming, items: [...existing.items, ...incoming.items] };
            },
          },
        },
      },
    },
  }),
});
