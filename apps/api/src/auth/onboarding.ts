import { z } from "zod";

/**
 * The set-up steps a new user is walked through after signing up, in
 * order. Each can be skipped; the current one is saved so leaving midway
 * resumes there, on any device.
 */
export const ONBOARDING_STEPS = ["preferences", "accounts", "habits"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** `{ step }` saves where they are; `{ done: true }` finishes (or skips the rest). */
export const onboardingSchema = z
  .object({ step: z.enum(ONBOARDING_STEPS), done: z.literal(true) })
  .partial()
  .refine((input) => input.step !== undefined || input.done !== undefined, "Send a step or done.");
export type OnboardingInput = z.infer<typeof onboardingSchema>;
