import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { AdminShell } from "#components/AdminShell";
import { RouteNotFound } from "#components/RouteStatus";
import type { RouterContext } from "../router";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <AdminShell>
      <Outlet />
    </AdminShell>
  ),
  notFoundComponent: RouteNotFound,
});
