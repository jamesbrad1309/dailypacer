import { describe, expect, it } from "vitest";
import { dayAt, localToday, monthAt, monthOffsetOf, offsetOf } from "#demo/demo-fixture";

describe("demo day offsets", () => {
  it("dayAt and offsetOf are inverses, across months and years", () => {
    expect(dayAt("2026-10-07", -7)).toBe("2026-09-30");
    expect(dayAt("2027-01-15", -56)).toBe("2026-11-20");
    expect(offsetOf("2026-10-07", "2026-09-15")).toBe(-22);
    for (const offset of [-400, -31, -1, 0, 1, 90]) {
      expect(offsetOf("2026-03-29", dayAt("2026-03-29", offset))).toBe(offset);
    }
  });

  it("monthAt and monthOffsetOf count calendar months", () => {
    expect(monthAt("2026-10-07", -1)).toBe("2026-09");
    expect(monthAt("2027-01-15", -2)).toBe("2026-11");
    expect(monthOffsetOf("2026-10-07", "2026-08")).toBe(-2);
    expect(monthOffsetOf("2027-01-31", "2026-12")).toBe(-1);
  });

  it("localToday is the local calendar day", () => {
    expect(localToday(new Date(2026, 9, 7, 23, 59))).toBe("2026-10-07");
  });
});
