import { AlertTriangle, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";

interface Props {
  /** What will happen, in full: what's deleted and what else it affects. */
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

/**
 * An inline "are you sure?" for a destructive action, shown in place of the
 * buttons that led to it. Focus starts on Cancel, so a reflex Enter keeps
 * things as they are; the destructive button is separate and labelled.
 */
export function ConfirmPrompt({ message, confirmLabel, onConfirm, onCancel, busy }: Props) {
  const { t } = useTranslation();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);

  return (
    <div
      role="alertdialog"
      aria-describedby={messageId}
      className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3"
    >
      <p id={messageId} className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <span>{message}</span>
      </p>
      <div className="flex justify-end gap-2">
        <Button ref={cancelRef} type="button" variant="outline" size="sm" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={onConfirm}>
          <Trash2 className="size-3.5" /> {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
