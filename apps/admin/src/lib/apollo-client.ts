import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

export const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: "/graphql" }),
  cache: new InMemoryCache({
    // A currency is identified by its code, not an id.
    typePolicies: { Currency: { keyFields: ["code"] } },
  }),
});
