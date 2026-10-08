import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NOTIFICATION_COUNTS_QUERY } from "#graphql/notifications";
import type { NotificationCounts } from "#graphql/types";
import { notificationClock } from "#lib/notifications";

/** How often the bell syncs the inbox: often enough for "time for your run". */
const SYNC_EVERY_MS = 60_000;

/**
 * The app bar's bell: the unread count, kept fresh by syncing the inbox
 * against the user's clock every minute and whenever the tab comes back.
 */
export function NotificationBell() {
  const { t } = useTranslation();
  const [clock, setClock] = useState(notificationClock);
  useEffect(() => {
    const tick = () => setClock(notificationClock());
    const timer = setInterval(tick, SYNC_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const { data } = useQuery<{ notificationCounts: NotificationCounts }>(NOTIFICATION_COUNTS_QUERY, {
    variables: { clock },
  });
  const unread = data?.notificationCounts.unread ?? 0;

  return (
    <Link
      to="/notifications"
      aria-label={t("notifications.bell", { count: unread })}
      title={t("notifications.bell", { count: unread })}
      className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      activeProps={{ className: "text-foreground" }}
    >
      <Bell className="size-4" />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] leading-none font-semibold text-white tabular-nums"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
