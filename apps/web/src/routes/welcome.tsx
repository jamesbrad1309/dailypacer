import { createFileRoute } from "@tanstack/react-router";
import { OnboardingWizard } from "#components/onboarding/OnboardingWizard";
import { useMe } from "#hooks/useMe";

export const Route = createFileRoute("/welcome")({
  staticData: { bare: true },
  component: function WelcomeRoute() {
    const me = useMe();
    // The root route only lets signed-in people here, so `me` is there.
    return me ? <OnboardingWizard me={me} /> : null;
  },
});
