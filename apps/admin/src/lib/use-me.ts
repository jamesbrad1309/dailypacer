import { useQuery } from "@apollo/client/react";
import { ME_QUERY } from "#graphql/auth";
import type { AdminMe } from "#graphql/types";

/** The signed-in user; the root route loads it before any page, so this reads the cache only. */
export function useMe(): AdminMe | null {
  const { data } = useQuery<{ me: AdminMe | null }>(ME_QUERY, { fetchPolicy: "cache-only" });
  return data?.me ?? null;
}
