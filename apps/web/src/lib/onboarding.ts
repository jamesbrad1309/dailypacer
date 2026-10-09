import type { Me, OnboardingStep } from "#graphql/types";

/** The set-up steps after signing up, in order (apps/api/src/auth/onboarding.ts). */
export const ONBOARDING_STEPS: OnboardingStep[] = ["PREFERENCES", "ACCOUNTS", "HABITS"];

/** Set by "Finish later": onboarding waits until the next visit (a new tab or sign-in). */
export const LATER_KEY = "dailypacer.onboarding.later";

/** Where the wizard opens: where they left off, else the first step. */
export function resumeStep(me: Pick<Me, "onboarding">): OnboardingStep {
  const saved = me.onboarding.step;
  return saved && ONBOARDING_STEPS.includes(saved) ? saved : ONBOARDING_STEPS[0];
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null;
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) - 1] ?? null;
}

/** Whether to send them to /welcome: not finished, and not put off for this visit. */
export function needsOnboarding(me: Pick<Me, "onboarding">, putOff: boolean): boolean {
  return me.onboarding.completedAt === null && !putOff;
}

export function putOffThisVisit(): boolean {
  try {
    return window.sessionStorage.getItem(LATER_KEY) === "1";
  } catch {
    return false;
  }
}

export function putOff(later: boolean): void {
  try {
    if (later) window.sessionStorage.setItem(LATER_KEY, "1");
    else window.sessionStorage.removeItem(LATER_KEY);
  } catch {
    // Storage blocked: onboarding just shows again on the next page load.
  }
}
