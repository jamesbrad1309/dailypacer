import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "#components/ui/skeleton";
import { cn } from "#lib/utils";

/**
 * Page-shaped placeholders, shown while a route's loader or a component's
 * first query is still running. Each mirrors the layout it stands in for, so
 * nothing jumps when the data arrives. The blocks themselves are hidden from
 * screen readers; the region announces "Loading…" once instead.
 */
function LoadingRegion({ children, className }: { children: ReactNode; className?: string }) {
  const { t } = useTranslation();
  return (
    // <output> has the implicit "status" role: announced politely, once.
    <output aria-busy className={cn("block", className)}>
      <span className="sr-only">{t("common.loading")}</span>
      {children}
    </output>
  );
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function StatTilesSkeleton() {
  return (
    <LoadingRegion className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {range(5).map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-14" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export function HabitCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <LoadingRegion className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {range(count).map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border bg-card p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="size-9 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-[94px] w-full" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex justify-end gap-2 border-t pt-2">
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <StatTilesSkeleton />
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <HabitCardsSkeleton />
    </div>
  );
}

export function HabitHistorySkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <LoadingRegion className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
      {range(rows).map((row) => (
        <div key={row} className="flex items-center gap-1">
          <Skeleton className="mr-3 h-4 w-28 shrink-0" />
          {range(30).map((i) => (
            <Skeleton key={i} className="aspect-square max-w-10 flex-1 rounded-[4px]" />
          ))}
          <Skeleton className="ml-3 h-4 w-16 shrink-0" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export function DayCalendarSkeleton() {
  return (
    <LoadingRegion className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="order-2 flex flex-col gap-6 rounded-xl border bg-card p-6 lg:order-1">
        <Skeleton className="h-4 w-24" />
        {range(8).map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-10" />
            <Skeleton className={cn("h-8", i % 3 === 1 ? "w-1/2" : "w-0")} />
          </div>
        ))}
      </div>
      <div className="order-1 flex flex-col gap-4 lg:order-2">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-2 w-full" />
        </div>
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-6">
          {range(3).map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

export function JournalEntriesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <LoadingRegion className="flex flex-col gap-4">
      {range(count).map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}

export function JournalSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-7 gap-1">
        {range(7).map((i) => (
          <Skeleton key={i} className="h-[72px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <JournalEntriesSkeleton />
    </div>
  );
}

export function JournalCalendarSkeleton() {
  return (
    <LoadingRegion className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {range(35).map((i) => (
          <Skeleton key={i} className="min-h-20 rounded-lg sm:min-h-24" />
        ))}
      </div>
      <Skeleton className="h-44 rounded-xl" />
    </LoadingRegion>
  );
}

/** Rows of a list or table: transactions, accounts, subscriptions, a habit's entries. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <LoadingRegion className="flex flex-col divide-y rounded-xl border bg-card">
      {range(rows).map((i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className={cn("h-4", i % 2 ? "w-1/3" : "w-1/2")} />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </LoadingRegion>
  );
}

/** The router's default: any page without a skeleton of its own. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
      <ListSkeleton />
    </div>
  );
}

export function HabitDetailSkeleton() {
  return (
    <LoadingRegion className="flex flex-col gap-6">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-6">
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {range(4).map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="flex flex-col divide-y rounded-xl border bg-card">
        {range(6).map((i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="ml-auto h-4 w-12" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
