import { describe, expect, it } from "vitest";
import type { JournalEntry } from "#graphql/types";
import { crossedMilestone } from "#lib/celebrate";
import { moodByDay, moodStreak, triggerPatterns } from "#lib/habit-mood";

describe("moodByDay", () => {
  it("scores each day's feelings, leaving out days without a known one", () => {
    const scores = moodByDay([
      { date: "2026-10-01", emotion: "happy", intensity: 3 },
      { date: "2026-10-02", emotion: "anxious", intensity: 4 },
      { date: "2026-10-03", emotion: "zzunknownzz", intensity: 4 },
    ]);
    expect(scores.get("2026-10-01")).toBe(1);
    expect(scores.get("2026-10-02")).toBe(-1);
    expect(scores.has("2026-10-03")).toBe(false);
  });
});

describe("moodStreak", () => {
  it("counts back from today, or from yesterday while today isn't logged yet", () => {
    const days = new Set(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(moodStreak(days, "2026-10-04")).toEqual({ current: 3, best: 3, loggedToday: false });
    expect(moodStreak(new Set([...days, "2026-10-04"]), "2026-10-04").current).toBe(4);
    expect(moodStreak(days, "2026-10-05").current).toBe(0);
  });

  it("finds the best run anywhere", () => {
    const days = new Set(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-10-03"]);
    expect(moodStreak(days, "2026-10-03")).toMatchObject({ current: 1, best: 4 });
  });
});

const feeling = (emotion: string, triggerId: string, tags: string[]): JournalEntry => ({
  id: `${emotion}-${triggerId}-${Math.random()}`,
  date: "2026-10-01",
  kind: "FEELING",
  time: null,
  text: "",
  tags: [],
  durationMinutes: null,
  emotion,
  intensity: 3,
  tone: null,
  trigger: { id: triggerId, kind: "EVENT", text: "", time: null, tags, tone: "NEGATIVE" },
});

describe("triggerPatterns", () => {
  it("groups linked feelings by their event's tags", () => {
    const patterns = triggerPatterns([
      feeling("stressed", "e1", ["work"]),
      feeling("stressed", "e2", ["work"]),
      feeling("anxious", "e2", ["work"]),
      feeling("happy", "e3", ["work", "team"]),
      feeling("happy", "e4", ["family"]),
    ]);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]).toMatchObject({
      tag: "work",
      events: 3,
      feelings: 4,
      top: { emotion: "stressed", count: 2 },
      unpleasant: 0.75,
      pleasant: 0.25,
    });
  });
});

describe("crossedMilestone", () => {
  it("names the milestone a streak just reached", () => {
    expect(crossedMilestone(6, 7)).toBe(7);
    expect(crossedMilestone(7, 8)).toBeNull();
    expect(crossedMilestone(29, 30)).toBe(30);
    expect(crossedMilestone(0, 0)).toBeNull();
  });
});
