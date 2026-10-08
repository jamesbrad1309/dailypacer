import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  Outlet,
  redirect,
  useMatches,
  useRouter,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppCrash } from "#components/layout/AppCrash";
import { AppShell } from "#components/layout/AppShell";
import { RouteNotFound } from "#components/layout/RouteStatus";
import { ME_QUERY } from "#graphql/auth";
import type { Me } from "#graphql/types";
import { safeRedirect } from "#lib/session";
import type { RouterContext } from "../router";

/** Pages for people who aren't signed in; everything else needs a session. */
const SIGNED_OUT_PATHS = ["/sign-in", "/sign-up"];

export const Route = createRootRouteWithContext<RouterContext>()({
  /**
   * The sign-in gate, before every navigation. `me` is cached after the
   * first check, so this costs nothing per page; sign-in, sign-out and an
   * ended session reset the cache. The API refuses unsigned requests either
   * way: this is for where to send people, not for security.
   */
  beforeLoad: async ({ context, location }) => {
    const { data } = await context.apolloClient.query<{ me: Me | null }>({ query: ME_QUERY });
    const me = data?.me ?? null;
    const signedOutPage = SIGNED_OUT_PATHS.includes(location.pathname);
    if (!me && !signedOutPage) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
    if (me && signedOutPage) {
      const target = (location.search as { redirect?: unknown }).redirect;
      throw redirect({ href: safeRedirect(target), replace: true });
    }
    return { me };
  },
  component: RootLayout,
  notFoundComponent: RouteNotFound,
  // The shell itself failed (sidebar, app bar): no shell to show a page error in.
  errorComponent: RootError,
  staticData: { page: "notFound" },
});

function RootLayout() {
  const { i18n } = useTranslation();
  // Sign-in and sign-up have no sidebar or app bar.
  const bare = useMatches({ select: (matches) => matches.some((m) => m.staticData.bare) });
  if (bare) return <Outlet key={i18n.language} />;
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
