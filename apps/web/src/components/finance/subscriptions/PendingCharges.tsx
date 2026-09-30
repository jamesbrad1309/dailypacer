import { useMutation, useQuery } from "@apollo/client/react";
import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MoneyInput } from "#components/finance/MoneyInput";
import { ServiceLogo } from "#components/finance/subscriptions/ServiceLogo";
import { Button } from "#components/ui/button";
import { Card } from "#components/ui/card";
import {
  CHARGE_REFETCH,
  CONFIRM_CHARGE_MUTATION,
  PENDING_CHARGES_QUERY,
  REOPEN_CHARGE_MUTATION,
  SKIP_CHARGE_MUTATION,
} from "#graphql/subscriptions";
import type { SubscriptionCharge } from "#graphql/types";
import { formatShortDate, todayIsoDate } from "#lib/dates";
import { formatMoney, parseMoneyInput, toMoneyInput } from "#lib/money";
import { toast } from "#lib/toast";

/**
 * Subscription charges that are due and waiting for an answer ("Ask each
 * time"). Confirming logs a transaction; skipping records that it wasn't
 * charged (or was logged another way). Both can be undone from the toast.
 * Renders nothing when there's nothing to answer.
 */
export function PendingCharges() {
  const { t } = useTranslation();
  const { data } = useQuery<{ pendingSubscriptionCharges: SubscriptionCharge[] }>(
    PENDING_CHARGES_QUERY,
    { variables: { today: todayIsoDate() } },
  );
  const charges = data?.pendingSubscriptionCharges ?? [];
  if (charges.length === 0) return null;

  return (
    <Card className="gap-0 overflow-hidden border-amber-500/40 py-0">
      <div className="border-b bg-amber-500/10 px-4 py-3">
        <h2 className="text-sm font-semibold">
          {t("finance.subscriptions.pending.title")}{" "}
          <span className="text-muted-foreground tabular-nums">{charges.length}</span>
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("finance.subscriptions.pending.hint")}
        </p>
      </div>
      <ul className="divide-y">
        {charges.map((charge) => (
          <PendingRow key={charge.id} charge={charge} />
        ))}
      </ul>
    </Card>
  );
}

function PendingRow({ charge }: { charge: SubscriptionCharge }) {
  const { t } = useTranslation();
  const { subscription: sub, currency } = charge;
  const [amount, setAmount] = useState(() => toMoneyInput(charge.amountMinor, currency));
  const [error, setError] = useState<string | null>(null);

  const options = { refetchQueries: CHARGE_REFETCH, awaitRefetchQueries: true };
  const [confirm, confirming] = useMutation(CONFIRM_CHARGE_MUTATION, options);
  const [skip, skipping] = useMutation(SKIP_CHARGE_MUTATION, options);
  const [reopen] = useMutation(REOPEN_CHARGE_MUTATION, options);
  const busy = confirming.loading || skipping.loading;
  const variables = { subscriptionId: sub.id, dueOn: charge.dueOn };
  const undo = { label: t("common.undo"), onClick: () => reopen({ variables }) };

  async function handleConfirm() {
    const amountMinor = parseMoneyInput(amount, currency);
    if (!amountMinor) return setError(t("finance.subscriptions.dialog.enterPrice"));
    try {
      await confirm({ variables: { ...variables, amountMinor } });
      toast(
        t("finance.subscriptions.pending.confirmed", {
          name: sub.name,
          amount: formatMoney(amountMinor, currency),
        }),
        { actions: [undo] },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  async function handleSkip() {
    try {
      await skip({ variables });
      toast(t("finance.subscriptions.pending.skipped", { name: sub.name }), { actions: [undo] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  const inputId = `charge-${charge.id}`;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <ServiceLogo name={sub.name} logoUrl={sub.logoUrl} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{sub.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {t("finance.subscriptions.pending.due", { date: formatShortDate(charge.dueOn) })} ·{" "}
          {sub.account.name}
        </p>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t("finance.subscriptions.pending.amountFor", { name: sub.name })}
        </label>
        <MoneyInput
          id={inputId}
          currency={currency}
          className="h-8 w-28"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Button size="sm" variant="ghost" disabled={busy} onClick={handleSkip}>
          {t("finance.subscriptions.pending.skip")}
        </Button>
        <Button size="sm" disabled={busy} onClick={handleConfirm}>
          <Check className="size-3.5" /> {t("finance.subscriptions.pending.confirm")}
        </Button>
      </div>
    </li>
  );
}
