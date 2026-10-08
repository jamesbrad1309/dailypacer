import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router";
import { Button } from "#components/ui/button";
import { Skeleton } from "#components/ui/skeleton";

/** A route's loader or component threw: keep the shell, offer a retry. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
      <p className="font-medium text-destructive">This page couldn't load.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Is the BFF running on :4000, and the API behind it?
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => {
          reset();
          router.invalidate();
        }}
      >
        Try again
      </Button>
    </div>
  );
}

export function RouteNotFound() {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
      <p className="font-medium text-foreground">No such page.</p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link to="/">Back to the overview</Link>
      </Button>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
