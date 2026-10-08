import { useMutation, useQuery } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCheck,
  Inbox,
  ListTodo,
  type LucideIcon,
  Mail,
  MailOpen,
  Repeat,
  Trophy,
  Undo2,
  Wallet,
} from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListSkeleton } from "#components/layout/Skeletons";
import { Button } from "#components/ui/button";
import { Card } from "#components/ui/card";
import { Checkbox } from "#components/ui/checkbox";
import {
  MARK_ALL_NOTIFICATIONS_READ_MUTATION,
  MARK_NOTIFICATIONS_MUTATION,
  NOTIFICATION_COUNTS_QUERY,
  NOTIFICATIONS_QUERY,
  NOTIFICATIONS_REFETCH,
} from "#graphql/notifications";
import type {
  AppNotification,
  NotificationCounts,
  NotificationReason,
  NotificationsData,
  NotificationView,
} from "#graphql/types";
import { useNotificationText } from "#hooks/useNotificationText";
import { formatTimeAgo, notificationClock } from "#lib/notifications";
import { toast } from "#lib/toast";
import { cn } from "#lib/utils";

/** The URL's view and reason, lowercased (routes/notifications.tsx). */
interface Search {
  view: "inbox" | "unread" | "saved" | "done";
  reason?: "task" | "money" | "habit" | "achievement";
}

interface Props {
  search: Search;
  onSearchChange: (next: Partial<Search>) => void;
}

const PAGE_SIZE = 30;
const VIEWS = ["inbox", "unread", "saved", "done"] as const;
const REASONS = ["task", "money", "habit", "achievement"] as const;

const REASON_ICON: Record<NotificationReason, { icon: LucideIcon; className: string }> = {
  TASK: { icon: ListTodo, className: "text-sky-600 dark:text-sky-400" },
  MONEY: { icon: Wallet, className: "text-emerald-600 dark:text-emerald-400" },
  HABIT: { icon: Repeat, className: "text-orange-600 dark:text-orange-400" },
  ACHIEVEMENT: { icon: Trophy, className: "text-amber-500" },
};

type Mark = { read?: boolean; done?: boolean; saved?: boolean };

/**
 * The inbox, GitHub style: Inbox, Unread, Saved and Done, filtered by what
 * it's about; select several to mark them at once, or use the keys on one.
 * Opening a notification marks it read.
 */
export function NotificationsView({ search, onSearchChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const describe = useNotificationText();
  const view = search.view.toUpperCase() as NotificationView;
  const reason = search.reason?.toUpperCase() as NotificationReason | undefined;
  // Synced against the clock once per visit; the bell keeps it fresh after that.
  const [clock] = useState(notificationClock);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const { data, loading, error, fetchMore } = useQuery<NotificationsData>(NOTIFICATIONS_QUERY, {
    variables: { view, reason, first: PAGE_SIZE, clock },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  const { data: countsData } = useQuery<{ notificationCounts: NotificationCounts }>(
    NOTIFICATION_COUNTS_QUERY,
    { variables: { clock } },
  );
  const [markMutation] = useMutation(MARK_NOTIFICATIONS_MUTATION, {
    refetchQueries: NOTIFICATIONS_REFETCH,
  });
  const [markAllRead, { loading: markingAll }] = useMutation<{ markAllNotificationsRead: number }>(
    MARK_ALL_NOTIFICATIONS_READ_MUTATION,
    { refetchQueries: NOTIFICATIONS_REFETCH },
  );

  const items = data?.notifications.items ?? [];
  const nextCursor = data?.notifications.nextCursor ?? null;
  const counts = countsData?.notificationCounts;
  const picked = items.filter((n) => selected.has(n.id));
  const inDone = view === "DONE";
  const inSaved = view === "SAVED";

  function go(next: Partial<Search>) {
    setSelected(new Set());
    onSearchChange(next);
  }

  async function mark(ids: string[], change: Mark) {
    if (ids.length === 0) return;
    await markMutation({ variables: { ids, ...change } });
    setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    if (change.done) {
      toast(t("notifications.doneToast", { count: ids.length }), {
        actions: [
          { label: t("common.undo"), onClick: () => void mark(ids, { done: false, read: false }) },
        ],
      });
    }
  }

  function open(n: AppNotification) {
    if (n.unread) void markMutation({ variables: { ids: [n.id], read: true } });
    if (n.link) navigate({ href: n.link });
  }

  function onRowKey(e: KeyboardEvent, n: AppNotification) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const change: Mark | null =
      e.key === "e"
        ? { done: !n.done }
        : e.key === "s"
          ? { saved: !n.saved }
          : e.key === "I"
            ? { read: true }
            : e.key === "U"
              ? { read: false }
              : null;
    if (!change) return;
    e.preventDefault();
    void mark([n.id], change);
  }

  const allPicked = items.length > 0 && picked.length === items.length;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <nav
        aria-label={t("notifications.filters")}
        className="flex shrink-0 flex-col gap-3 md:sticky md:top-4 md:w-52"
      >
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {VIEWS.map((v) => (
            <li key={v}>
              <FilterLink
                active={search.view === v}
                onClick={() => go({ view: v })}
                icon={
                  { inbox: Inbox, unread: Mail, saved: Bookmark, done: CheckCheck }[v] as LucideIcon
                }
                label={t(`notifications.views.${v.toUpperCase() as NotificationView}`)}
                count={v === "inbox" ? counts?.unread : undefined}
              />
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1">
          <p className="hidden px-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase md:block">
            {t("notifications.filters")}
          </p>
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            <li>
              <FilterLink
                active={!search.reason}
                onClick={() => go({ reason: undefined })}
                label={t("notifications.allReasons")}
              />
            </li>
            {REASONS.map((r) => {
              const key = r.toUpperCase() as NotificationReason;
              return (
                <li key={r}>
                  <FilterLink
                    active={search.reason === r}
                    onClick={() => go({ reason: r })}
                    icon={REASON_ICON[key].icon}
                    iconClassName={REASON_ICON[key].className}
                    label={t(`notifications.reasons.${key}`)}
                    count={counts?.[r]}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <Card className="min-w-0 flex-1 gap-0 overflow-hidden py-0">
        <div className="flex min-h-12 flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2">
          <Checkbox
            aria-label={t("notifications.selectAll")}
            disabled={items.length === 0}
            checked={allPicked ? true : picked.length > 0 ? "indeterminate" : false}
            onCheckedChange={() =>
              setSelected(allPicked ? new Set() : new Set(items.map((n) => n.id)))
            }
          />
          {picked.length > 0 ? (
            <>
              <span className="text-sm font-medium">
                {t("notifications.selected", { count: picked.length })}
              </span>
              <div className="ml-auto flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    mark(
                      picked.map((n) => n.id),
                      { read: true },
                    )
                  }
                >
                  <MailOpen className="size-4" /> {t("notifications.markRead")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    mark(
                      picked.map((n) => n.id),
                      { read: false },
                    )
                  }
                >
                  <Mail className="size-4" /> {t("notifications.markUnread")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    mark(
                      picked.map((n) => n.id),
                      { saved: !inSaved },
                    )
                  }
                >
                  <Bookmark className="size-4" />{" "}
                  {inSaved ? t("notifications.unsave") : t("notifications.save")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    mark(
                      picked.map((n) => n.id),
                      { done: !inDone },
                    )
                  }
                >
                  {inDone ? <Undo2 className="size-4" /> : <Check className="size-4" />}{" "}
                  {inDone ? t("notifications.moveToInbox") : t("notifications.markDone")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <span className="text-sm font-medium">
                {t(`notifications.views.${view}`)}
                {reason && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {t(`notifications.reasons.${reason}`)}
                  </span>
                )}
              </span>
              {(view === "INBOX" || view === "UNREAD") && (counts?.unread ?? 0) > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  disabled={markingAll}
                  onClick={async () => {
                    const { data: done } = await markAllRead({ variables: { reason } });
                    toast(
                      t("notifications.markedAllRead", {
                        count: done?.markAllNotificationsRead ?? 0,
                      }),
                    );
                  }}
                >
                  <CheckCheck className="size-4" /> {t("notifications.markAllRead")}
                </Button>
              )}
            </>
          )}
        </div>

        {error && <p className="px-4 py-3 text-sm text-destructive">{error.message}</p>}
        {loading && items.length === 0 && (
          <div className="p-4">
            <ListSkeleton />
          </div>
        )}

        {!loading && items.length === 0 && !error && (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Inbox className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">{t(`notifications.empty.${view}.title`)}</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t(`notifications.empty.${view}.text`)}
            </p>
          </div>
        )}

        {items.length > 0 && (
          <ul className="divide-y">
            {items.map((n) => {
              const { title, detail } = describe(n);
              const { icon: Icon, className: tone } = REASON_ICON[n.reason];
              return (
                <li
                  key={n.id}
                  onKeyDown={(e) => onRowKey(e, n)}
                  className={cn(
                    "group flex items-start gap-3 px-4 py-3 hover:bg-accent/40 focus-within:bg-accent/40",
                    selected.has(n.id) && "bg-primary/5",
                  )}
                >
                  <Checkbox
                    className="mt-1"
                    aria-label={t("notifications.selectOne", { title })}
                    checked={selected.has(n.id)}
                    onCheckedChange={(checked) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (checked === true) next.add(n.id);
                        else next.delete(n.id);
                        return next;
                      })
                    }
                  />
                  <span className="relative mt-0.5 shrink-0">
                    <Icon className={cn("size-4", tone)} aria-hidden />
                    {n.unread && (
                      <span className="-left-2.5 absolute top-1 size-1.5 rounded-full bg-sky-500">
                        <span className="sr-only">{t("notifications.unreadDot")}</span>
                      </span>
                    )}
                  </span>
                  <a
                    href={n.link ?? undefined}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      open(n);
                    }}
                    className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={cn(
                        "block text-sm",
                        n.unread ? "font-semibold" : "text-muted-foreground",
                      )}
                    >
                      {title}
                    </span>
                    {detail && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{detail}</span>
                    )}
                  </a>
                  <div className="flex shrink-0 items-center gap-1">
                    <time
                      dateTime={n.surfacedAt}
                      title={new Date(n.surfacedAt).toLocaleString()}
                      className="text-xs whitespace-nowrap text-muted-foreground group-focus-within:hidden group-hover:hidden"
                    >
                      {formatTimeAgo(n.surfacedAt)}
                    </time>
                    <fieldset
                      aria-label={t("notifications.actionsFor", { title })}
                      className="m-0 flex min-w-0 gap-0.5 border-0 p-0 sm:hidden sm:group-focus-within:flex sm:group-hover:flex"
                    >
                      <RowAction
                        label={
                          n.done ? t("notifications.moveToInbox") : t("notifications.markDone")
                        }
                        icon={n.done ? Undo2 : Check}
                        onClick={() => mark([n.id], { done: !n.done })}
                      />
                      <RowAction
                        label={n.saved ? t("notifications.unsave") : t("notifications.save")}
                        icon={n.saved ? BookmarkCheck : Bookmark}
                        onClick={() => mark([n.id], { saved: !n.saved })}
                      />
                      <RowAction
                        label={
                          n.unread ? t("notifications.markRead") : t("notifications.markUnread")
                        }
                        icon={n.unread ? MailOpen : Mail}
                        onClick={() => mark([n.id], { read: n.unread })}
                      />
                    </fieldset>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {nextCursor && (
          <div className="border-t p-3 text-center">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => fetchMore({ variables: { after: nextCursor } })}
            >
              {loading ? t("common.loading") : t("common.loadMore")}
            </Button>
          </div>
        )}
        <p className="hidden border-t px-4 py-2 text-xs text-muted-foreground sm:block">
          {t("notifications.keysHint")}
        </p>
      </Card>
    </div>
  );
}

function FilterLink({
  active,
  onClick,
  icon: Icon,
  iconClassName,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  iconClassName?: string;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm whitespace-nowrap transition-colors",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      {Icon && <Icon className={cn("size-4 shrink-0", iconClassName)} aria-hidden />}
      {label}
      {count ? (
        <span className="ml-auto rounded-full bg-muted px-1.5 text-xs tabular-nums">{count}</span>
      ) : null}
    </button>
  );
}

function RowAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon className="size-3.5" />
    </Button>
  );
}
