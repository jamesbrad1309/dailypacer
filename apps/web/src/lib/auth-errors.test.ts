import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { describe, expect, it } from "vitest";
import { authErrorKey, authReason } from "./auth-errors";

const graphQLError = (extensions: Record<string, unknown>) =>
  new CombinedGraphQLErrors({ data: null, errors: [{ message: "x", extensions }] });

describe("authReason", () => {
  it("reads the API's reason code", () => {
    expect(authReason(graphQLError({ code: "FORBIDDEN", reason: "READ_ONLY" }))).toBe("READ_ONLY");
    expect(authReason(graphQLError({ code: "UNAUTHENTICATED", reason: "WRONG_CREDENTIALS" }))).toBe(
      "WRONG_CREDENTIALS",
    );
  });

  it("ignores codes it doesn't translate and other errors", () => {
    expect(authReason(graphQLError({ code: "FORBIDDEN", reason: "SOMETHING_NEW" }))).toBeNull();
    expect(authReason(graphQLError({ code: "BAD_USER_INPUT" }))).toBeNull();
    expect(authReason(new TypeError("Failed to fetch"))).toBeNull();
  });
});

describe("authErrorKey", () => {
  it("falls back to the generic message", () => {
    expect(authErrorKey(graphQLError({ reason: "ACCOUNT_PENDING" }))).toBe(
      "auth.errors.ACCOUNT_PENDING",
    );
    expect(authErrorKey(new Error("boom"))).toBe("auth.errors.generic");
  });
});
