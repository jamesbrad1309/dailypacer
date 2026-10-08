import { CombinedGraphQLErrors, ServerError, ServerParseError } from "@apollo/client/errors";

/**
 * Every way a request or page can fail, sorted into the few cases someone
 * can act on. The BFF gives each GraphQL error a stable `extensions.code`
 * (apps/bff/src/clients/api-client.ts); everything else is told apart here.
 */
export type ErrorKind =
  /** The browser has no network. */
  | "offline"
  /** The admin's own server (Vite) didn't answer. */
  | "admin-unreachable"
  /** The proxy answered but the BFF didn't (502/503/504). */
  | "bff-unreachable"
  /** The BFF answered but the API behind it didn't. */
  | "api-unreachable"
  /** The BFF doesn't know this query: it's older than the admin. */
  | "schema-mismatch"
  /** This page's code couldn't load: the admin was rebuilt, or its server stopped. */
  | "stale-build"
  | "not-found"
  | "invalid-input"
  | "conflict"
  /** The API or BFF failed (5xx); the details are in their logs. */
  | "server"
  | "unknown";

export interface DescribedError {
  kind: ErrorKind;
  title: string;
  /** What to do about it. */
  hint: string;
  /** The raw message (and code), for the "Details" disclosure. */
  details: string;
  /** Trying again could work without changing anything. */
  retryable: boolean;
}

const COPY: Record<ErrorKind, { title: string; hint: string; retryable: boolean }> = {
  offline: {
    title: "You're offline",
    hint: "Check your connection; the page retries when you try again.",
    retryable: true,
  },
  "admin-unreachable": {
    title: "The admin server isn't answering",
    hint: "Start it again with `pnpm dev:admin`, then try again.",
    retryable: true,
  },
  "bff-unreachable": {
    title: "Can't reach the BFF",
    hint: "Start it with `pnpm dev:bff` (port 4000), or point `BFF_URL` at a running one.",
    retryable: true,
  },
  "api-unreachable": {
    title: "The API isn't answering",
    hint: "The BFF is up but the API behind it isn't. Start it with `pnpm dev:api` (port 3000).",
    retryable: true,
  },
  "schema-mismatch": {
    title: "The BFF is out of date",
    hint: "It doesn't know a query this page uses. Rebuild and restart the BFF (in Docker: `docker compose up -d --build bff`).",
    retryable: false,
  },
  "stale-build": {
    title: "This page's code couldn't load",
    hint: "The admin may have been updated or stopped. Reload the page; if it doesn't come back, start it with `pnpm dev:admin`.",
    retryable: false,
  },
  "not-found": {
    title: "Not found",
    hint: "It may have been deleted. The list has been refreshed.",
    retryable: false,
  },
  "invalid-input": {
    title: "That wasn't accepted",
    hint: "Check the values and try again.",
    retryable: false,
  },
  conflict: {
    title: "That clashes with something else",
    hint: "Change it and try again.",
    retryable: false,
  },
  server: {
    title: "Something went wrong on the server",
    hint: "Try again. If it keeps failing, the API's and BFF's logs say why.",
    retryable: true,
  },
  unknown: {
    title: "Something went wrong",
    hint: "Try again, or reload the page.",
    retryable: true,
  },
};

function kindOf(error: unknown, online: boolean): ErrorKind {
  if (CombinedGraphQLErrors.is(error)) {
    const codes = error.errors.map((e) => e.extensions?.code);
    if (codes.includes("UPSTREAM_UNAVAILABLE")) return "api-unreachable";
    if (codes.includes("GRAPHQL_VALIDATION_FAILED")) return "schema-mismatch";
    if (codes.includes("NOT_FOUND")) return "not-found";
    if (codes.includes("BAD_USER_INPUT")) return "invalid-input";
    if (codes.includes("CONFLICT")) return "conflict";
    return "server";
  }
  if (ServerError.is(error) || ServerParseError.is(error)) {
    if (!online) return "offline";
    return [502, 503, 504].includes(error.statusCode) ? "bff-unreachable" : "server";
  }
  const message = error instanceof Error ? error.message : "";
  // A code-split chunk that no longer exists after a rebuild (Chrome, Firefox, Safari).
  if (
    /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
      message,
    )
  ) {
    return "stale-build";
  }
  // fetch() rejects with a TypeError when nothing answers at all.
  if (error instanceof TypeError && /fetch|network|load failed/i.test(message)) {
    return online ? "admin-unreachable" : "offline";
  }
  return "unknown";
}

function detailsOf(error: unknown): string {
  if (CombinedGraphQLErrors.is(error)) {
    return error.errors
      .map((e) => (e.extensions?.code ? `${e.message} (${e.extensions.code})` : e.message))
      .join("\n");
  }
  if (ServerError.is(error) || ServerParseError.is(error)) {
    return `HTTP ${error.statusCode}: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export function describeError(
  error: unknown,
  // Only an explicit false means offline (Node has a navigator without onLine).
  online = globalThis.navigator?.onLine !== false,
): DescribedError {
  const kind = kindOf(error, online);
  const copy = COPY[kind];
  // Validation and clash messages come from the API and are written for people.
  const hint =
    (kind === "invalid-input" || kind === "conflict") && CombinedGraphQLErrors.is(error)
      ? error.errors.map((e) => e.message).join(" ")
      : copy.hint;
  return { kind, title: copy.title, hint, details: detailsOf(error), retryable: copy.retryable };
}
