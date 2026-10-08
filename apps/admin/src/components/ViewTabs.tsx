import { Link } from "@tanstack/react-router";

/** Tabs that switch a page's `?view=` search param, with a count on each. */
export function ViewTabs<View extends string>({
  label,
  views,
  current,
}: {
  label: string;
  views: { view: View; label: string; count: number }[];
  current: View;
}) {
  return (
    <nav aria-label={label} className="mb-4 flex gap-1 border-b">
      {views.map(({ view, label: text, count }) => (
        <Link
          key={view}
          to="."
          // "." is the current page, which the router can't type statically; each
          // page's validateSearch checks `view` and falls back to its default.
          search={{ view } as never}
          aria-current={view === current ? "page" : undefined}
          className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
        >
          {text} <span className="tabular-nums text-muted-foreground">{count}</span>
        </Link>
      ))}
    </nav>
  );
}
