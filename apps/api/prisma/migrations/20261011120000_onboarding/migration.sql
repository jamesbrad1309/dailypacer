-- Onboarding (src/auth/onboarding.ts): where a new user is in the set-up
-- steps, and when they finished.
ALTER TABLE "users" ADD COLUMN "onboardingStep" TEXT,
ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- People who already use the app don't need walking through it.
UPDATE "users" SET "onboardedAt" = CURRENT_TIMESTAMP;
