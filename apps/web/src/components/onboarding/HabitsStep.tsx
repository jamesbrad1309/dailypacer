import { useMutation } from "@apollo/client/react";
import { Check } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";
import { CREATE_HABIT_MUTATION } from "#graphql/habits";
import { createHabitInput, templateDraft } from "#lib/habit-draft";
import { HABIT_TEMPLATES, type TemplateId } from "#lib/habit-templates";
import { toast } from "#lib/toast";

/** Pick starter habits from the templates; Finish adds them and ends onboarding. */
export function HabitsStep({
  onDone,
  footer,
}: {
  onDone: () => void;
  footer: (actions: ReactNode) => ReactNode;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<Set<TemplateId>>(new Set());
  const [busy, setBusy] = useState(false);
  const [createHabit] = useMutation(CREATE_HABIT_MUTATION);

  function toggle(id: TemplateId) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  async function finish() {
    setBusy(true);
    try {
      // One at a time, in the order shown, so the dashboard keeps that order.
      for (const template of HABIT_TEMPLATES.filter((tpl) => picked.has(tpl.id))) {
        await createHabit({ variables: { input: createHabitInput(templateDraft(template, t)) } });
      }
      onDone();
    } catch {
      toast(t("onboarding.error"));
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="text-lg font-semibold">{t("onboarding.habits.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.habits.body")}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {HABIT_TEMPLATES.map((template) => {
          const on = picked.has(template.id);
          return (
            <button
              key={template.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(template.id)}
              className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent aria-pressed:border-foreground aria-pressed:bg-foreground/5"
            >
              <span className="text-xl" aria-hidden>
                {template.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {t(`habits.templates.${template.id}.name`)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t(`habits.templates.${template.id}.description`)}
                </span>
              </span>
              {on && <Check className="size-4 shrink-0" aria-hidden />}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
        {t("onboarding.habits.selected", { count: picked.size })}
      </p>
      {footer(
        <Button onClick={finish} disabled={busy}>
          {busy
            ? t("onboarding.saving")
            : picked.size
              ? t("onboarding.habits.finish")
              : t("onboarding.habits.finishNone")}
        </Button>,
      )}
    </>
  );
}
