import { useQuery } from "@apollo/client/react";
import { ME_QUERY } from "#graphql/auth";
import type { Me } from "#graphql/types";

/**
 * The signed-in user. The root route loads it before any page renders, so
 * inside the app this is always there; it reads the cache only.
 */
export function useMe(): Me | null {
  const { data } = useQuery<{ me: Me | null }>(ME_QUERY, { fetchPolicy: "cache-only" });
  return data?.me ?? null;
}
