import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  Outlet,
  redirect,
  useMatches,
  useRouter,
} from "@tanstack/react-router";
import { AdminShell } from "#components/AdminShell";
import { AppCrash } from "#components/AppCrash";
import { NoAccess } from "#components/NoAccess";
import { RouteNotFound } from "#components/RouteStatus";
import { ME_QUERY } from "#graphql/auth";
import type { AdminMe } from "#graphql/types";
import { safeRedirect } from "#lib/session";
import type { RouterContext } from "../router";

export const Route = createRootRouteWithContext<RouterContext>()({
  /**
   * The sign-in gate: signed out → /sign-in (and back afterwards). Whether
   * the role may open the admin is decided by the API (`abilities.openAdmin`,
   * from its access rules) and enforced there on every call; here it only
   * picks what to show.
   */
  beforeLoad: async ({ context, location }) => {
    const { data } = await context.apolloClient.query<{ me: AdminMe | null }>({ query: ME_QUERY });
    const me = data?.me ?? null;
    if (!me && location.pathname !== "/sign-in") {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
    if (me && location.pathname === "/sign-in") {
      const target = (location.search as { redirect?: unknown }).redirect;
      throw redirect({ href: safeRedirect(target), replace: true });
    }
    return { me };
  },
  component: RootLayout,
  // Any URL no route matches, rendered inside the shell.
  notFoundComponent: RouteNotFound,
  // The shell itself failed: there's no sidebar left to show a page error in.
  errorComponent: RootError,
});

function RootLayout() {
  const { me } = Route.useRouteContext();
  const bare = useMatches({ select: (matches) => matches.some((m) => m.staticData.bare) });
  if (bare) return <Outlet />;
  if (me && !me.abilities.openAdmin) return <NoAccess me={me} />;
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
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
