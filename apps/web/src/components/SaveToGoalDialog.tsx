import { useMutation, useQuery } from "@apollo/client/react";
import { Check, PiggyBank } from "lucide-react";
import { type FormEvent, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { MoneyInput } from "#components/finance/MoneyInput";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#components/ui/dialog";
import { Label } from "#components/ui/label";
import {
  ACCOUNTS_QUERY,
  CONTRIBUTE_TO_SAVINGS_GOAL_MUTATION,
  CREATE_TRANSFER_MUTATION,
  SAVINGS_GOALS_QUERY,
  TRANSACTIONS_REFETCH,
} from "#graphql/finance";
import type { AccountsData, Habit, SavingsGoalsData } from "#graphql/types";
import { todayIsoDate } from "#lib/dates";
import { isDoneToday } from "#lib/habit-today";
import { currencyDigits, formatMoney, parseMoneyInput, toMoneyInput } from "#lib/money";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

interface State {
  open: boolean;
  /** As typed; starts at the habit's daily amount. */
  amount: string;
  /** Linked goals: the account the transfer comes from; "" for the default. */
  fromId: string;
  error: string | null;
}

type Action =
  | { type: "open"; on: boolean; amount: string }
  | { type: "amount"; value: string }
  | { type: "from"; value: string }
  | { type: "error"; message: string | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "open":
      return { open: action.on, amount: action.amount, fromId: "", error: null };
    case "amount":
      return { ...state, amount: action.value };
    case "from":
      return { ...state, fromId: action.value };
    case "error":
      return { ...state, error: action.message };
  }
}

/**
 * A savings goal's daily habit, ticked by putting money aside: added to an
 * unlinked goal, or moved by transfer into the account a linked goal
 * follows. Finance then ticks the habit (docs/finance/habits-integration.md §2).
 */
export function SaveToGoalDialog({ habit, id }: { habit: Habit; id?: string }) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const { data: goalsData } = useQuery<SavingsGoalsData>(SAVINGS_GOALS_QUERY, {
    variables: { today },
  });
  const goal = goalsData?.savingsGoals.find((g) => g.id === habit.savingsGoalId);
  const currency = goal?.currency ?? habit.unit ?? "GBP";
  const dailyMinor =
    habit.targetValue !== null
      ? Math.round(habit.targetValue * 10 ** currencyDigits(currency))
      : null;
  const [state, dispatch] = useReducer(reducer, {
    open: false,
    amount: "",
    fromId: "",
    error: null,
  });
  const { data: accountsData } = useQuery<AccountsData>(ACCOUNTS_QUERY, { skip: !state.open });
  // Same currency only: a transfer across currencies needs both amounts.
  const sources = (accountsData?.accounts ?? []).filter(
    (a) => a.id !== goal?.account?.id && a.currency === currency,
  );
  const from =
    sources.find((a) => a.id === state.fromId) ?? sources.find((a) => a.isDefault) ?? sources[0];

  const options = { refetchQueries: TRANSACTIONS_REFETCH, awaitRefetchQueries: true };
  const [contribute, contributing] = useMutation(CONTRIBUTE_TO_SAVINGS_GOAL_MUTATION, options);
  const [transfer, transferring] = useMutation(CREATE_TRANSFER_MUTATION, options);
  const done = isDoneToday(habit);
  const saved = habit.todayEntry?.value ?? 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!goal) return;
    const amountMinor = parseMoneyInput(state.amount, currency);
    if (!amountMinor || amountMinor <= 0) {
      return dispatch({ type: "error", message: t("finance.goals.enterAmount") });
    }
    try {
      if (goal.account) {
        if (!from) return dispatch({ type: "error", message: t("habits.saveToGoal.noSource") });
        await transfer({
          variables: {
            input: {
              fromAccountId: from.id,
              toAccountId: goal.account.id,
              amountMinor,
              date: today,
              clientId: crypto.randomUUID(),
            },
          },
        });
      } else {
        await contribute({ variables: { id: goal.id, amountMinor, today } });
      }
      dispatch({ type: "open", on: false, amount: "" });
    } catch (err) {
      dispatch({ type: "error", message: err instanceof Error ? err.message : null });
    }
  }

  return (
    <Dialog
      open={state.open}
      onOpenChange={(on) =>
        dispatch({ type: "open", on, amount: dailyMinor ? toMoneyInput(dailyMinor, currency) : "" })
      }
    >
      <DialogTrigger asChild>
        <Button
          id={id}
          size="sm"
          variant={done ? "ghost" : "outline"}
          className="h-7 gap-1 px-2 text-xs tabular-nums"
          aria-label={t("habits.saveToGoal.open", { name: habit.name })}
          disabled={!goal}
        >
          {done ? <Check className="size-3.5" /> : <PiggyBank className="size-3.5" />}
          {saved > 0
            ? t("habits.saveToGoal.savedToday", {
                amount: formatMoney(Math.round(saved * 10 ** currencyDigits(currency)), currency),
              })
            : t("habits.saveToGoal.putAside")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>
              {t("habits.saveToGoal.title", { goal: goal?.name ?? habit.name })}
            </DialogTitle>
            <DialogDescription>
              {goal?.account
                ? t("habits.saveToGoal.linkedHint", { account: goal.account.name })
                : t("habits.saveToGoal.unlinkedHint")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="save-amount">{t("habits.saveToGoal.amount")}</Label>
            <MoneyInput
              id="save-amount"
              currency={currency}
              value={state.amount}
              autoFocus
              onChange={(e) => dispatch({ type: "amount", value: e.target.value })}
            />
          </div>

          {goal?.account && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="save-from">{t("habits.saveToGoal.from")}</Label>
              <select
                id="save-from"
                className={selectClass}
                value={from?.id ?? ""}
                onChange={(e) => dispatch({ type: "from", value: e.target.value })}
              >
                {sources.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => dispatch({ type: "open", on: false, amount: "" })}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={contributing.loading || transferring.loading}>
              {t("habits.saveToGoal.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
