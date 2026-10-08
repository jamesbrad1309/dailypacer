import { Link } from "@tanstack/react-router";
import { CloudOff, LayoutDashboard, type LucideIcon, ShieldAlert, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useOnline } from "#lib/use-online";

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/accounts", label: "Accounts", icon: Wallet },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const online = useOnline();
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="border-b bg-muted/40 md:w-56 md:shrink-0 md:border-r md:border-b-0">
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
      </aside>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 border-b bg-status-warning/15 px-4 py-2 text-sm">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          No sign-in yet: anyone who can open this page can change the data. Run it on this machine
          only.
        </p>
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
