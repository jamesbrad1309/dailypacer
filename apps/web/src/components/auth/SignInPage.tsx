import { useMutation } from "@apollo/client/react";
import { Link, useRouter } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout, Field, FormError } from "#components/auth/AuthLayout";
import { Button } from "#components/ui/button";
import { ME_QUERY, SIGN_IN_MUTATION } from "#graphql/auth";
import type { Me } from "#graphql/types";
import { apolloClient } from "#lib/apollo-client";
import { authErrorKey } from "#lib/auth-errors";
import { isValidEmail, safeRedirect } from "#lib/session";

export function SignInPage({ redirect, ended }: { redirect?: string; ended?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [signIn, { loading }] = useMutation<{ signIn: Me }>(SIGN_IN_MUTATION);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!isValidEmail(email)) return setError(t("auth.errors.emailInvalid"));
    if (!password) return setError(t("auth.errors.WRONG_CREDENTIALS"));
    setError(null);
    try {
      const { data } = await signIn({ variables: { email, password } });
      if (!data) return;
      // Nothing from a previous session should show through.
      await apolloClient.clearStore();
      apolloClient.writeQuery({ query: ME_QUERY, data: { me: data.signIn } });
      await router.navigate({ href: safeRedirect(redirect), replace: true });
    } catch (failure) {
      setError(t(authErrorKey(failure)));
    }
  }

  return (
    <AuthLayout
      title={t("auth.signIn.title")}
      subtitle={t("auth.signIn.subtitle")}
      footer={
        <>
          {t("auth.signIn.noAccount")}{" "}
          <Link to="/sign-up" className="font-medium text-foreground underline">
            {t("auth.signIn.signUpLink")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-4">
        {ended && !error && (
          <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
            {t("auth.signIn.sessionEnded")}
          </p>
        )}
        <FormError message={error} />
        <Field
          id="email"
          label={t("auth.signIn.email")}
          type="email"
          autoComplete="username"
          inputMode="email"
          autoFocus
          required
        />
        <Field
          id="password"
          label={t("auth.signIn.password")}
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? t("auth.signIn.submitting") : t("auth.signIn.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
