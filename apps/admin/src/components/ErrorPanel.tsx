import { AlertTriangle, CloudOff, ServerCrash } from "lucide-react";
import type { ReactNode } from "react";
import type { DescribedError, ErrorKind } from "#lib/errors";
import { cn } from "#lib/utils";

const UNREACHABLE: ErrorKind[] = [
  "offline",
  "admin-unreachable",
  "bff-unreachable",
  "api-unreachable",
];

/**
 * One failure, explained: what happened, what to do, and the raw message
 * behind a "Details" disclosure. `compact` is the inline version shown above
 * a table after a failed action.
 */
export function ErrorPanel({
  error,
  actions,
  compact = false,
}: {
  error: DescribedError;
  actions?: ReactNode;
  compact?: boolean;
}) {
  const Icon =
    error.kind === "offline"
      ? CloudOff
      : UNREACHABLE.includes(error.kind)
        ? ServerCrash
        : AlertTriangle;
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5",
        compact ? "mb-4 px-4 py-3" : "p-6",
      )}
    >
      <div className="flex gap-3">
        <Icon
          className={cn("shrink-0 text-destructive", compact ? "mt-0.5 size-4" : "size-6")}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium text-destructive", !compact && "text-lg")}>{error.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{withCode(error.hint)}</p>
          {error.details && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Details</summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                {error.details}
              </pre>
            </details>
          )}
          {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

/** `pnpm dev:api` in a hint → a <code> span. */
function withCode(text: string): ReactNode[] {
  return text.split("`").map((part, i) =>
    i % 2 ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one fixed string
      <code key={i} className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
        {part}
      </code>
    ) : (
      part
    ),
  );
}
