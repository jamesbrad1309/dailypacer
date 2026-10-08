import { type FormEvent, useState } from "react";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";

/**
 * Confirms an action, optionally asking for one value first (a new name, a
 * rate). Closes only when `onConfirm` succeeds; a failure stays on the page.
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  field,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  field?: {
    label: string;
    initial: string;
    inputMode?: "text" | "decimal";
    placeholder?: string;
    /** A problem with the value, or null when it can be saved. */
    validate?: (value: string) => string | null;
  };
  pending: boolean;
  onConfirm: (value: string) => Promise<boolean>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Keyed by `open` so each opening starts from the field's initial value. */}
        {open && (
          <PromptForm
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            destructive={destructive}
            field={field}
            pending={pending}
            onCancel={() => onOpenChange(false)}
            onConfirm={async (value) => {
              if (await onConfirm(value)) onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PromptForm({
  title,
  description,
  confirmLabel,
  destructive,
  field,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  destructive: boolean;
  field?: Parameters<typeof PromptDialog>[0]["field"];
  pending: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState(field?.initial ?? "");
  const problem = field?.validate?.(value) ?? null;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!problem) onConfirm(value.trim());
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      {field && (
        <div className="grid gap-2">
          <Label htmlFor="prompt-value">{field.label}</Label>
          <Input
            id="prompt-value"
            value={value}
            inputMode={field.inputMode}
            placeholder={field.placeholder}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? "prompt-problem" : undefined}
            autoFocus
          />
          {problem && value !== "" && (
            <p id="prompt-problem" className="text-sm text-destructive">
              {problem}
            </p>
          )}
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant={destructive ? "destructive" : "default"}
          disabled={pending || Boolean(problem)}
        >
          {pending ? "Working…" : confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
