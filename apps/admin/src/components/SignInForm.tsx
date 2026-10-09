import { useMutation } from "@apollo/client/react";
import { useRouter } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { ErrorPanel } from "#components/ErrorPanel";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import { ME_QUERY, SIGN_IN_MUTATION } from "#graphql/auth";
import type { AdminMe } from "#graphql/types";
import { apolloClient } from "#lib/apollo-client";
import { type DescribedError, describeError } from "#lib/errors";
import { safeRedirect } from "#lib/session";

/** Wrong password, pending account…: the API's own words, which are written for people. */
function signInError(error: unknown): DescribedError {
  const described = describeError(error);
  if (described.kind === "signed-out" || described.kind === "forbidden") {
    return { ...described, title: "Couldn't sign you in" };
  }
  return described;
}

function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · DailyPacer Admin`;
  }, [title]);
}

export function SignInForm({ redirect, ended }: { redirect?: string; ended?: boolean }) {
  const router = useRouter();
  const [signIn, { loading }] = useMutation<{ signIn: AdminMe }>(SIGN_IN_MUTATION);
  const [error, setError] = useState<DescribedError | null>(null);
  useTitle("Sign in");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      const { data } = await signIn({
        variables: {
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
        },
      });
      if (!data) return;
      await apolloClient.clearStore();
      apolloClient.writeQuery({ query: ME_QUERY, data: { me: data.signIn } });
      await router.navigate({ href: safeRedirect(redirect), replace: true });
    } catch (failure) {
      setError(signInError(failure));
    }
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-muted/30 px-4 pt-[12vh]">
      <div className="w-full max-w-sm">
        <p className="mb-3 text-sm font-medium text-muted-foreground">DailyPacer Admin</p>
        <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-card p-6 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Owners and admins only.</p>
          </div>
          {ended && !error && (
            <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
              Your session ended. Sign in again to continue.
            </p>
          )}
          {error && <ErrorPanel compact error={error} />}
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
