import { ShieldX } from "lucide-react";
import { useEffect } from "react";
import { SignOutButton } from "#components/SignOutButton";
import type { AdminMe } from "#graphql/types";

/** Signed in, but the access rules keep this role out of the admin. */
function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · DailyPacer Admin`;
  }, [title]);
}

export function NoAccess({ me }: { me: AdminMe }) {
  useTitle("No access");
  return (
    <div className="flex min-h-dvh items-start justify-center bg-muted/30 px-4 pt-[12vh]">
      <div
        role="alert"
        className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm"
      >
        <ShieldX className="mx-auto size-10 text-muted-foreground" aria-hidden />
        <p className="mt-4 text-sm font-medium text-muted-foreground">403</p>
        <h1 className="mt-1 text-xl font-semibold">No access to the admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You're signed in as {me.email} ({me.role.toLowerCase()}). Only owners and admins can open
          the admin dashboard.
        </p>
        <SignOutButton className="mt-6 w-full" variant="default" />
      </div>
    </div>
  );
}
