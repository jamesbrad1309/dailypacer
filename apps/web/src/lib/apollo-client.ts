import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ErrorLink } from "@apollo/client/link/error";
import i18n from "i18next";
import { authErrorKey } from "#lib/auth-errors";
import { SIGNED_OUT_OPERATIONS, sessionEnded } from "#lib/session";
import { toast } from "#lib/toast";

/**
 * Access errors, handled once for the whole app:
 * - UNAUTHENTICATED: the session ended (signed out elsewhere, expired,
 *   disabled), so go to sign-in. Except on the auth operations themselves,
 *   where it just means "wrong password" or "not signed in".
 * - FORBIDDEN on a mutation: the access rules said no (a viewer saving
 *   something); say why. Queries that fail this way show their own error.
 */
const accessErrors = new ErrorLink(({ error, operation }) => {
  if (!CombinedGraphQLErrors.is(error)) return;
  const codes = error.errors.map((e) => e.extensions?.code);
  if (
    codes.includes("UNAUTHENTICATED") &&
    !SIGNED_OUT_OPERATIONS.has(operation.operationName ?? "")
  ) {
    sessionEnded();
    return;
  }
  const isMutation = operation.query.definitions.some(
    (d) => d.kind === "OperationDefinition" && d.operation === "mutation",
  );
  if (
    codes.includes("FORBIDDEN") &&
    isMutation &&
    !SIGNED_OUT_OPERATIONS.has(operation.operationName ?? "")
  ) {
    toast(i18n.t(authErrorKey(error)));
  }
});

export const apolloClient = new ApolloClient({
  link: ApolloLink.from([accessErrors, new HttpLink({ uri: "/graphql" })]),
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
