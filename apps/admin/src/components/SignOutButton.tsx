import { useMutation } from "@apollo/client/react";
import { useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "#components/ui/button";
import { SIGN_OUT_MUTATION } from "#graphql/auth";
import { apolloClient } from "#lib/apollo-client";

export function SignOutButton({
  className,
  variant = "ghost",
}: {
  className?: string;
  variant?: "ghost" | "default" | "outline";
}) {
  const router = useRouter();
  const [signOut, { loading }] = useMutation(SIGN_OUT_MUTATION);
  return (
    <Button
      variant={variant}
      size="sm"
      className={className}
      disabled={loading}
      onClick={async () => {
        // Signed out locally even if the request fails.
        await signOut().catch(() => undefined);
        await apolloClient.clearStore();
        await router.navigate({ to: "/sign-in", replace: true });
      }}
    >
      <LogOut className="size-4" aria-hidden />
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
