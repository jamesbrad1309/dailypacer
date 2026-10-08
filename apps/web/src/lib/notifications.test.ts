import { describe, expect, it } from "vitest";
import { formatTimeAgo, notificationClock } from "#lib/notifications";

describe("notificationClock", () => {
  it("is the local day and HH:mm", () => {
    expect(notificationClock(new Date(2026, 9, 8, 7, 5))).toEqual({
      today: "2026-10-08",
      time: "07:05",
    });
  });
});

describe("formatTimeAgo", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

  it.each([
    [10, "now"],
    [5 * 60, "5 minutes ago"],
    [3 * 3600, "3 hours ago"],
    [86_400, "yesterday"],
    [3 * 86_400, "3 days ago"],
    [15 * 86_400, "2 weeks ago"],
  ])("%i seconds is %s", (seconds, text) => {
    expect(formatTimeAgo(ago(seconds), now, "en")).toBe(text);
  });

  it("never says a time in the future", () => {
    expect(formatTimeAgo(ago(-60), now, "en")).toBe("now");
  });
});
