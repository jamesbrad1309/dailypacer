import { useMutation } from "@apollo/client/react";
import { useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, FormError } from "#components/auth/AuthLayout";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { CHANGE_PASSWORD_MUTATION, SIGN_OUT_MUTATION } from "#graphql/auth";
import { useMe } from "#hooks/useMe";
import { apolloClient } from "#lib/apollo-client";
import { authErrorKey } from "#lib/auth-errors";
import { PASSWORD_MIN_LENGTH } from "#lib/session";
import { toast } from "#lib/toast";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() ||
    "?"
  );
}

/** The app bar's account button: who's signed in, change password, sign out. */
export function UserMenu() {
  const { t } = useTranslation();
  const me = useMe();
  const [open, setOpen] = useState(false);
  if (!me) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("auth.menu.open", { name: me.name })}
        title={me.email}
        className="flex size-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {initials(me.name)}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("auth.menu.title")}</DialogTitle>
            <DialogDescription>
              {me.name} · {me.email}
            </DialogDescription>
          </DialogHeader>
          <p className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("auth.menu.role")}</span>
            <Badge variant="secondary">{t(`auth.roles.${me.role}`)}</Badge>
          </p>
          {open && <ChangePasswordForm />}
          <SignOutButton />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChangePasswordForm() {
  const { t } = useTranslation();
  const [changePassword, { loading }] = useMutation(CHANGE_PASSWORD_MUTATION);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return setError(t("auth.errors.passwordTooShort", { count: PASSWORD_MIN_LENGTH }));
    }
    setError(null);
    try {
      await changePassword({ variables: { currentPassword, newPassword } });
      formElement.reset();
      toast(t("auth.menu.saved"));
    } catch (failure) {
      setError(t(authErrorKey(failure)));
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 border-t pt-4">
      <div>
        <p className="font-medium">{t("auth.menu.changePassword")}</p>
        <p className="text-xs text-muted-foreground">{t("auth.menu.changePasswordHint")}</p>
      </div>
      <FormError message={error} />
      <Field
        id="currentPassword"
        label={t("auth.menu.currentPassword")}
        type="password"
        autoComplete="current-password"
        required
      />
      <Field
        id="newPassword"
        label={t("auth.menu.newPassword")}
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        hint={t("auth.signUp.passwordHint", { count: PASSWORD_MIN_LENGTH })}
        required
      />
      <Button type="submit" variant="outline" disabled={loading}>
        {loading ? t("auth.menu.saving") : t("auth.menu.save")}
      </Button>
    </form>
  );
}

function SignOutButton() {
  const { t } = useTranslation();
  const router = useRouter();
  const [signOut, { loading }] = useMutation(SIGN_OUT_MUTATION);
  return (
    <Button
      variant="ghost"
      className="justify-start"
      disabled={loading}
      onClick={async () => {
        // Signed out locally even if the request fails: the cookie is the BFF's to clear.
        await signOut().catch(() => undefined);
        await apolloClient.clearStore();
        await router.navigate({ to: "/sign-in", replace: true });
      }}
    >
      <LogOut className="size-4" aria-hidden />
      {loading ? t("auth.menu.signingOut") : t("auth.menu.signOut")}
    </Button>
  );
}
