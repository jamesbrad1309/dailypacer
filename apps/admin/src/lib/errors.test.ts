import { CombinedGraphQLErrors, ServerError, ServerParseError } from "@apollo/client/errors";
import { describe, expect, it } from "vitest";
import { describeError } from "./errors";

function graphQLError(code: string, message = "boom") {
  return new CombinedGraphQLErrors({ data: null, errors: [{ message, extensions: { code } }] });
}

function serverError(status: number) {
  return new ServerError("Response not successful", {
    response: new Response("Bad Gateway", { status }),
    bodyText: "Bad Gateway",
  });
}

describe("describeError", () => {
  it("tells apart which service is down", () => {
    expect(describeError(new TypeError("Failed to fetch")).kind).toBe("admin-unreachable");
    expect(describeError(serverError(502)).kind).toBe("bff-unreachable");
    expect(describeError(serverError(504)).kind).toBe("bff-unreachable");
    expect(describeError(graphQLError("UPSTREAM_UNAVAILABLE")).kind).toBe("api-unreachable");
  });

  it("blames the connection when the browser is offline", () => {
    expect(describeError(new TypeError("Failed to fetch"), false).kind).toBe("offline");
    expect(describeError(serverError(502), false).kind).toBe("offline");
  });

  it("maps the BFF's error codes", () => {
    expect(describeError(graphQLError("NOT_FOUND")).kind).toBe("not-found");
    expect(describeError(graphQLError("GRAPHQL_VALIDATION_FAILED")).kind).toBe("schema-mismatch");
    expect(describeError(graphQLError("UPSTREAM_ERROR")).kind).toBe("server");
    expect(describeError(graphQLError("INTERNAL_SERVER_ERROR")).kind).toBe("server");
    expect(describeError(serverError(500)).kind).toBe("server");
  });

  it("shows the API's own words for input problems", () => {
    const error = graphQLError("BAD_USER_INPUT", "An account's type can't change");
    expect(describeError(error)).toMatchObject({
      kind: "invalid-input",
      hint: "An account's type can't change",
      retryable: false,
    });
  });

  it("asks for a reload when a code-split chunk is gone", () => {
    const error = new TypeError(
      "Failed to fetch dynamically imported module: http://127.0.0.1:5174/assets/accounts-1a2b.js",
    );
    expect(describeError(error)).toMatchObject({ kind: "stale-build", retryable: false });
  });

  it("keeps the raw message and code for the details", () => {
    expect(describeError(graphQLError("NOT_FOUND", "Account 42 not found")).details).toBe(
      "Account 42 not found (NOT_FOUND)",
    );
    expect(describeError(serverError(502)).details).toMatch(/^HTTP 502/);
    expect(
      describeError(
        new ServerParseError(new Error("bad json"), {
          response: new Response("<html>", { status: 200 }),
          bodyText: "<html>",
        }),
      ).kind,
    ).toBe("server");
  });

  it("falls back for anything else", () => {
    expect(describeError(new Error("weird"))).toMatchObject({ kind: "unknown", retryable: true });
    expect(describeError("a string").details).toBe("a string");
  });
});
