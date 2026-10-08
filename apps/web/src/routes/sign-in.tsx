import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SignInPage } from "#components/auth/SignInPage";

export const Route = createFileRoute("/sign-in")({
  staticData: { bare: true },
  validateSearch: z.object({
    // Where to go afterwards; safeRedirect() keeps it inside the app.
    redirect: z.string().max(2000).optional().catch(undefined),
    // Sent here because the session ended mid-use.
    ended: z.boolean().optional().catch(undefined),
  }),
  component: function SignInRoute() {
    const { redirect, ended } = Route.useSearch();
    return <SignInPage redirect={redirect} ended={ended} />;
  },
});
