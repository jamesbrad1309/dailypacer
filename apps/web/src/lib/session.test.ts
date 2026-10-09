import { describe, expect, it } from "vitest";
import { isValidEmail, safeRedirect } from "./session";

describe("safeRedirect", () => {
  it("keeps in-app paths with their search", () => {
    expect(safeRedirect("/finance/transactions?tag=coffee")).toBe(
      "/finance/transactions?tag=coffee",
    );
    expect(safeRedirect("/")).toBe("/");
  });

  it("refuses anything that leaves the app", () => {
    for (const target of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "",
      42,
      undefined,
    ]) {
      expect(safeRedirect(target)).toBe("/");
    }
  });

  it("doesn't send someone back to the auth pages", () => {
    expect(safeRedirect("/sign-in?redirect=/")).toBe("/");
    expect(safeRedirect("/sign-up")).toBe("/");
  });
});

describe("isValidEmail", () => {
  it("wants something@something.tld", () => {
    expect(isValidEmail(" a@b.co ")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });
});
