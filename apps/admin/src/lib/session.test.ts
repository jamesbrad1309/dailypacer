import { describe, expect, it } from "vitest";
import { safeRedirect } from "./session";

describe("safeRedirect", () => {
  it("keeps in-app paths and refuses everything else", () => {
    expect(safeRedirect("/accounts?view=archived")).toBe("/accounts?view=archived");
    for (const target of [
      "https://evil.example",
      "//evil.example",
      "/\\evil",
      "/sign-in",
      1,
      undefined,
    ]) {
      expect(safeRedirect(target)).toBe("/");
    }
  });
});
