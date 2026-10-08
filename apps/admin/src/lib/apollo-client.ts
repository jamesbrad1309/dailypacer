import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { ErrorLink } from "@apollo/client/link/error";
import { SIGNED_OUT_OPERATIONS, sessionEnded } from "#lib/session";

/** A request came back "not signed in" mid-use: the session ended, so go to sign-in. */
const sessionErrors = new ErrorLink(({ error, operation }) => {
  if (!CombinedGraphQLErrors.is(error)) return;
  if (SIGNED_OUT_OPERATIONS.has(operation.operationName ?? "")) return;
  if (error.errors.some((e) => e.extensions?.code === "UNAUTHENTICATED")) sessionEnded();
});

export const apolloClient = new ApolloClient({
  link: ApolloLink.from([sessionErrors, new HttpLink({ uri: "/graphql" })]),
  cache: new InMemoryCache(),
});
