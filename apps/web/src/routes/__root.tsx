import {
  type ErrorComponentProps,
  Outlet,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppCrash } from "#components/layout/AppCrash";
import { AppShell } from "#components/layout/AppShell";
import { RouteNotFound } from "#components/layout/RouteStatus";
import type { RouterContext } from "../router";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: RouteNotFound,
  // The shell itself failed (sidebar, app bar): no shell to show a page error in.
  errorComponent: RootError,
  staticData: { page: "notFound" },
});

function RootLayout() {
  const { i18n } = useTranslation();
  // Keyed by language: switching re-renders everything, including numbers
  // and dates formatted outside `t()` (lib/money.ts, lib/dates.ts).
  return (
    <AppShell key={i18n.language}>
      <Outlet />
    </AppShell>
  );
}

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
