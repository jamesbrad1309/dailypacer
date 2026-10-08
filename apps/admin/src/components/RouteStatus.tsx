import { type ErrorComponentProps, Link, useLocation, useRouter } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import { ErrorPanel } from "#components/ErrorPanel";
import { Button } from "#components/ui/button";
import { Skeleton } from "#components/ui/skeleton";
import { describeError } from "#lib/errors";

/** A page's loader or component threw: keep the shell, say what failed, offer a way out. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const { pathname } = useLocation();
  const described = describeError(error);
  return (
    <ErrorPanel
      error={described}
      actions={
        <>
          {described.kind === "stale-build" ? (
            <Button onClick={() => window.location.reload()}>Reload</Button>
          ) : (
            <Button
              onClick={() => {
                reset();
                router.invalidate();
              }}
            >
              Try again
            </Button>
          )}
          {pathname !== "/" && (
            <Button asChild variant="outline">
              <Link to="/">Go to the overview</Link>
            </Button>
          )}
        </>
      }
    />
  );
}

/** No route matches the URL (or a loader said the record doesn't exist). */
export function RouteNotFound() {
  const { pathname } = useLocation();
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center">
      <FileQuestion className="mx-auto size-10 text-muted-foreground" aria-hidden />
      <p className="mt-4 text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-1 text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Nothing lives at <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{pathname}</code>.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button asChild>
          <Link to="/accounts">Accounts</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Overview</Link>
        </Button>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div role="status" className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-80" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
