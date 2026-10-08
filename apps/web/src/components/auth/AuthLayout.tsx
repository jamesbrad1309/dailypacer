import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitch } from "#components/layout/AppShell";

/** The frame for the signed-out pages: no sidebar, one centred card. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  // The app shell names the tab for other pages; these render without it.
  useEffect(() => {
    document.title = `${title} · ${t("auth.brand")}`;
  }, [title, t]);
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="font-semibold">{t("auth.brand")}</span>
        <LanguageSwitch />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-[8vh] pb-12">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h1 className="text-xl font-semibold">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <p className="mt-4 text-center text-sm text-muted-foreground">{footer}</p>}
        </div>
      </main>
    </div>
  );
}

/** A labelled input with its own error line, wired up for screen readers. */
export function Field({
  id,
  label,
  error,
  hint,
  ...input
}: {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
} & React.ComponentProps<"input">) {
  const described = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none aria-invalid:border-destructive"
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** The form-level error: wrong password, pending account, and so on. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}
