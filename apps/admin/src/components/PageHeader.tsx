import type { ReactNode } from "react";
import { ErrorPanel } from "#components/ErrorPanel";
import { Button } from "#components/ui/button";
import type { DescribedError } from "#lib/errors";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

/** The last failed action, explained, until the next one runs or it's dismissed. */
export function ActionError({
  error,
  onDismiss,
}: {
  error: DescribedError | null;
  onDismiss: () => void;
}) {
  if (!error) return null;
  return (
    <ErrorPanel
      compact
      error={error}
      actions={
        <Button size="sm" variant="outline" onClick={onDismiss}>
          Dismiss
        </Button>
      }
    />
  );
}

/** One table's empty state. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}
