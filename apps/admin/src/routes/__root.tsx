import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  Outlet,
  useRouter,
} from "@tanstack/react-router";
import { AdminShell } from "#components/AdminShell";
import { AppCrash } from "#components/AppCrash";
import { RouteNotFound } from "#components/RouteStatus";
import type { RouterContext } from "../router";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <AdminShell>
      <Outlet />
    </AdminShell>
  ),
  // Any URL no route matches, rendered inside the shell.
  notFoundComponent: RouteNotFound,
  // The shell itself failed: there's no sidebar left to show a page error in.
  errorComponent: RootError,
});

function RootError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <AppCrash
      error={error}
      onRetry={() => {
        reset();
        router.invalidate();
      }}
    />
  );
}
