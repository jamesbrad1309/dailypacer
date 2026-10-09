import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SignInForm } from "#components/SignInForm";

export const Route = createFileRoute("/sign-in")({
  staticData: { bare: true },
  validateSearch: z.object({
    redirect: z.string().max(2000).optional().catch(undefined),
    ended: z.boolean().optional().catch(undefined),
  }),
  component: function SignInRoute() {
    const { redirect, ended } = Route.useSearch();
    return <SignInForm redirect={redirect} ended={ended} />;
  },
});
