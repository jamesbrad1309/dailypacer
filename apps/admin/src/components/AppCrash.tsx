import { ErrorPanel } from "#components/ErrorPanel";
import { Button } from "#components/ui/button";
import { describeError } from "#lib/errors";

/**
 * Full-page fallback for when the shell itself can't render, so there's no
 * sidebar to navigate with. Page errors render inside the shell instead
 * (RouteStatus.tsx).
 */
export function AppCrash({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const described = describeError(error);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-lg">
        <p className="mb-3 text-sm font-medium text-muted-foreground">DailyPacer Admin</p>
        <ErrorPanel
          error={described}
          actions={
            <>
              {onRetry && described.kind !== "stale-build" && (
                <Button onClick={onRetry}>Try again</Button>
              )}
              <Button
                variant={onRetry ? "outline" : "default"}
                onClick={() => window.location.reload()}
              >
                Reload
              </Button>
              {/* A plain link: this may render outside the router. */}
              <Button asChild variant="ghost">
                <a href="/">Go to the overview</a>
              </Button>
            </>
          }
        />
      </div>
    </div>
  );
}
