import { describe, expect, it } from "vitest";
import { MAX_FAILURES, SignInThrottle, WINDOW_MS } from "./sign-in-throttle";

describe("SignInThrottle", () => {
  it("locks an email after too many failures, until the window passes", () => {
    let now = 0;
    const throttle = new SignInThrottle(() => now);
    for (let i = 0; i < MAX_FAILURES; i++) {
      expect(throttle.retryAfter("a@x.com")).toBe(0);
      throttle.fail("a@x.com");
      now += 1000;
    }
    expect(throttle.retryAfter("a@x.com")).toBe(WINDOW_MS - MAX_FAILURES * 1000);
    expect(throttle.retryAfter("b@x.com")).toBe(0);
    now = WINDOW_MS + 1;
    expect(throttle.retryAfter("a@x.com")).toBe(0);
  });

  it("forgets failures after a success", () => {
    const throttle = new SignInThrottle(() => 0);
    for (let i = 0; i < MAX_FAILURES; i++) throttle.fail("a@x.com");
    throttle.succeed("a@x.com");
    expect(throttle.retryAfter("a@x.com")).toBe(0);
  });
});
