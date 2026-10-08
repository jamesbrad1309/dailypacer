import { describe, expect, it } from "vitest";
import { needsOnboarding, nextStep, previousStep, resumeStep } from "./onboarding";

const me = (step: string | null, completedAt: string | null = null) =>
  ({ onboarding: { step, completedAt } }) as Parameters<typeof resumeStep>[0];

describe("onboarding steps", () => {
  it("resumes where they left off, else starts at the beginning", () => {
    expect(resumeStep(me(null))).toBe("PREFERENCES");
    expect(resumeStep(me("HABITS"))).toBe("HABITS");
    expect(resumeStep(me("SOMETHING_OLD"))).toBe("PREFERENCES");
  });

  it("walks forward and back, stopping at the ends", () => {
    expect(nextStep("PREFERENCES")).toBe("ACCOUNTS");
    expect(nextStep("HABITS")).toBeNull();
    expect(previousStep("ACCOUNTS")).toBe("PREFERENCES");
    expect(previousStep("PREFERENCES")).toBeNull();
  });

  it("shows until finished, unless put off for this visit", () => {
    expect(needsOnboarding(me(null), false)).toBe(true);
    expect(needsOnboarding(me(null), true)).toBe(false);
    expect(needsOnboarding(me(null, "2026-10-08T10:00:00Z"), false)).toBe(false);
  });
});
