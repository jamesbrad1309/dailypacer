import { useMutation } from "@apollo/client/react";
import { Link, useRouter } from "@tanstack/react-router";
import { type FormEvent, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout, Field, FormError } from "#components/auth/AuthLayout";
import { Button } from "#components/ui/button";
import { ME_QUERY, SIGN_UP_MUTATION } from "#graphql/auth";
import type { Me, UserStatus } from "#graphql/types";
import { apolloClient } from "#lib/apollo-client";
import { authErrorKey } from "#lib/auth-errors";
import { isValidEmail, PASSWORD_MIN_LENGTH } from "#lib/session";

type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;
type State = { fields: FieldErrors; form: string | null; pendingName: string | null };
type Event =
  | { type: "invalid"; fields: FieldErrors }
  | { type: "failed"; message: string }
  | { type: "pending"; name: string }
  | { type: "reset" };

function reducer(state: State, event: Event): State {
  switch (event.type) {
    case "invalid":
      return { ...state, fields: event.fields, form: null };
    case "failed":
      return { ...state, fields: {}, form: event.message };
    case "pending":
      return { fields: {}, form: null, pendingName: event.name };
    case "reset":
      return { fields: {}, form: null, pendingName: null };
  }
}

export function SignUpPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [signUp, { loading }] = useMutation<{ signUp: { status: UserStatus; me: Me | null } }>(
    SIGN_UP_MUTATION,
  );
  const [state, dispatch] = useReducer(reducer, { fields: {}, form: null, pendingName: null });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fields: FieldErrors = {};
    if (!name) fields.name = t("auth.errors.nameRequired");
    if (!isValidEmail(email)) fields.email = t("auth.errors.emailInvalid");
    if (password.length < PASSWORD_MIN_LENGTH) {
      fields.password = t("auth.errors.passwordTooShort", { count: PASSWORD_MIN_LENGTH });
    }
    if (Object.keys(fields).length) return dispatch({ type: "invalid", fields });

    try {
      const { data } = await signUp({ variables: { input: { name, email, password } } });
      if (!data) return;
      if (data.signUp.me) {
        // The first account of an empty database: its owner, signed straight in.
        await apolloClient.clearStore();
        apolloClient.writeQuery({ query: ME_QUERY, data: { me: data.signUp.me } });
        await router.navigate({ to: "/", replace: true });
        return;
      }
      dispatch({ type: "pending", name });
    } catch (failure) {
      dispatch({ type: "failed", message: t(authErrorKey(failure)) });
    }
  }

  if (state.pendingName) {
    return (
      <AuthLayout title={t("auth.signUp.pendingTitle", { name: state.pendingName })}>
        <p className="text-sm text-muted-foreground">{t("auth.signUp.pendingBody")}</p>
        <Button asChild className="mt-6 w-full">
          <Link to="/sign-in">{t("auth.signUp.backToSignIn")}</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("auth.signUp.title")}
      subtitle={t("auth.signUp.subtitle")}
      footer={
        <>
          {t("auth.signUp.haveAccount")}{" "}
          <Link to="/sign-in" className="font-medium text-foreground underline">
            {t("auth.signUp.signInLink")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="grid gap-4">
        <FormError message={state.form} />
        <Field
          id="name"
          label={t("auth.signUp.name")}
          autoComplete="name"
          autoFocus
          error={state.fields.name}
          required
        />
        <Field
          id="email"
          label={t("auth.signUp.email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          error={state.fields.email}
          required
        />
        <Field
          id="password"
          label={t("auth.signUp.password")}
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          hint={t("auth.signUp.passwordHint", { count: PASSWORD_MIN_LENGTH })}
          error={state.fields.password}
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? t("auth.signUp.submitting") : t("auth.signUp.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
