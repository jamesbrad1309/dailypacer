import { Link } from "@tanstack/react-router";
import { CloudOff, LayoutDashboard, type LucideIcon, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { SignOutButton } from "#components/SignOutButton";
import { Badge } from "#components/ui/badge";
import { useMe } from "#lib/use-me";
import { useOnline } from "#lib/use-online";

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/users", label: "Users", icon: Users },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const online = useOnline();
  const me = useMe();
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex flex-col border-b bg-muted/40 md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <div className="px-4 py-4">
          <p className="font-semibold">DailyPacer</p>
          <p className="text-xs text-muted-foreground">Admin</p>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:font-medium data-[status=active]:text-foreground"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        {me && (
          <div className="mt-auto hidden border-t px-4 py-3 md:block">
            <p className="truncate text-sm font-medium">{me.name}</p>
            <p className="truncate text-xs text-muted-foreground">{me.email}</p>
            <Badge variant="secondary" className="mt-2">
              {me.role.charAt(0) + me.role.slice(1).toLowerCase()}
            </Badge>
            <SignOutButton className="mt-2 -ml-2 w-full justify-start" />
          </div>
        )}
      </aside>
      <div className="min-w-0 flex-1">
        {!online && (
          <p role="status" className="flex items-center gap-2 border-b bg-muted px-4 py-2 text-sm">
            <CloudOff className="size-4 shrink-0" aria-hidden />
            You're offline. Changes won't save until the connection is back.
          </p>
        )}
        <main id="main" className="mx-auto max-w-6xl px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
