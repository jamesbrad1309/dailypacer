import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";

interface Props {
  error: unknown;
  /** Re-render without reloading (the root route's error); omitted, the only way out is a reload. */
  onRetry?: () => void;
}

/**
 * Full-page fallback for when the app shell itself can't render, so there's
 * no sidebar left to navigate with. Page-level errors don't come here: they
 * render inside the shell (RouteStatus.tsx's RouteError).
 */
export function AppCrash({ error, onRetry }: Props) {
  const { t } = useTranslation();
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground">
      <div role="alert" className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <AlertTriangle className="size-6 text-destructive" />
        <h1 className="mt-3 text-lg font-semibold">{t("shell.crash.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("shell.crash.body")}</p>
        {message && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              {t("shell.crash.details")}
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
              {message}
            </pre>
          </details>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {onRetry && <Button onClick={onRetry}>{t("shell.route.tryAgain")}</Button>}
          <Button
            variant={onRetry ? "outline" : "default"}
            onClick={() => window.location.reload()}
          >
            {t("shell.crash.reload")}
          </Button>
          {/* A plain link: this may render outside the router. */}
          <Button asChild variant="ghost">
            <a href="/">{t("shell.route.goHome")}</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
