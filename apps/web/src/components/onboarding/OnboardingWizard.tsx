import { useMutation } from "@apollo/client/react";
import { useRouter } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccountsStep } from "#components/onboarding/AccountsStep";
import { HabitsStep } from "#components/onboarding/HabitsStep";
import { PreferencesStep } from "#components/onboarding/PreferencesStep";
import { Button } from "#components/ui/button";
import { UPDATE_ONBOARDING_MUTATION } from "#graphql/auth";
import type { Me, OnboardingStep } from "#graphql/types";
import { nextStep, ONBOARDING_STEPS, previousStep, putOff, resumeStep } from "#lib/onboarding";
import { toast } from "#lib/toast";
import { cn } from "#lib/utils";

/**
 * The set-up steps after signing up: basics (language, main currency), money
 * accounts, starter habits. Every step can be skipped; the step is saved on
 * the server as they move, so leaving midway ("Finish later", or closing the
 * tab) resumes there next time, on any device.
 */
export function OnboardingWizard({ me }: { me: Me }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(() => resumeStep(me));
  const [save] = useMutation(UPDATE_ONBOARDING_MUTATION);
  const index = ONBOARDING_STEPS.indexOf(step);

  useEffect(() => {
    document.title = `${t(`onboarding.steps.${step}`)} · ${t("auth.brand")}`;
  }, [step, t]);

  function go(target: OnboardingStep) {
    setStep(target);
    // Remembering the step is best-effort: if it fails they just resume a step earlier.
    void save({ variables: { step: target } }).catch(() => undefined);
  }

  async function finish() {
    try {
      await save({ variables: { done: true } });
    } catch {
      toast(t("onboarding.error"));
      return;
    }
    putOff(false);
    toast(t("onboarding.done"));
    await router.navigate({ to: "/", replace: true });
  }

  function later() {
    putOff(true);
    void router.navigate({ to: "/" });
  }

  const forward = () => {
    const next = nextStep(step);
    if (next) go(next);
    else void finish();
  };
  const back = previousStep(step);

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="flex items-center justify-between gap-4 px-4 py-3">
        <span className="font-semibold">{t("auth.brand")}</span>
        <Button variant="ghost" size="sm" onClick={later}>
          {t("onboarding.later")}
        </Button>
      </header>
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 pt-[4vh] pb-12">
        <h1 className="text-2xl font-semibold">{t("onboarding.title", { name: me.name })}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.subtitle")}</p>

        <ol
          className="mt-6 flex gap-2"
          aria-label={t("onboarding.stepOf", {
            current: index + 1,
            total: ONBOARDING_STEPS.length,
          })}
        >
          {ONBOARDING_STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={s === step ? "step" : undefined}
              className={cn(
                "flex flex-1 items-center gap-2 border-t-4 pt-2 text-xs font-medium",
                i < index && "border-foreground text-foreground",
                i === index && "border-foreground text-foreground",
                i > index && "border-border text-muted-foreground",
              )}
            >
              {i < index && <Check className="size-3.5" aria-hidden />}
              {t(`onboarding.steps.${s}`)}
            </li>
          ))}
        </ol>

        <section className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
          {step === "PREFERENCES" && (
            <PreferencesStep
              onDone={forward}
              footer={(actions) => <StepFooter back={null} actions={actions} onSkip={forward} />}
            />
          )}
          {step === "ACCOUNTS" && (
            <AccountsStep
              footer={(actions) => (
                <StepFooter back={() => back && go(back)} actions={actions} onSkip={forward} />
              )}
              onDone={forward}
            />
          )}
          {step === "HABITS" && (
            <HabitsStep
              footer={(actions) => (
                <StepFooter back={() => back && go(back)} actions={actions} onSkip={forward} />
              )}
              onDone={finish}
            />
          )}
        </section>
      </main>
    </div>
  );
}

/** Back on the left; Skip and the step's own action on the right. */
function StepFooter({
  back,
  onSkip,
  actions,
}: {
  back: (() => void) | null;
  onSkip: () => void;
  actions: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
      {back && (
        <Button variant="ghost" onClick={back}>
          {t("onboarding.back")}
        </Button>
      )}
      <div className="ml-auto flex gap-2">
        <Button variant="outline" onClick={onSkip}>
          {t("onboarding.skip")}
        </Button>
        {actions}
      </div>
    </div>
  );
}
