import { useMutation, useQuery } from "@apollo/client/react";
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
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import {
  ACCOUNTS_QUERY,
  CREATE_SAVINGS_GOAL_MUTATION,
  UPDATE_SAVINGS_GOAL_MUTATION,
} from "#graphql/finance";
import type { AccountsData, SavingsGoal } from "#graphql/types";
import { useCurrencies } from "#hooks/useCurrencies";
import { todayIsoDate } from "#lib/dates";
import { parseMoneyInput, toMoneyInput } from "#lib/money";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this goal; a new one when left out. */
  goal?: SavingsGoal;
}

interface State {
  name: string;
  emoji: string;
  target: string;
  /** "YYYY-MM-DD" or "" for none. */
  deadline: string;
  /** "" for not linked. */
  accountId: string;
  /** Unlinked new goals: what's already put aside. */
  saved: string;
  error: string | null;
}

type Action =
  | { [K in keyof State]: { type: "set"; field: K; value: State[K] } }[keyof State]
  | { type: "reset"; state: State };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "reset":
      return action.state;
  }
}

function initialState(goal: SavingsGoal | undefined): State {
  return {
    name: goal?.name ?? "",
    emoji: goal?.emoji ?? "",
    target: goal ? toMoneyInput(goal.targetMinor, goal.currency) : "",
    deadline: goal?.deadline ?? "",
    accountId: goal?.account?.id ?? "",
    saved: "",
    error: null,
  };
}

/**
 * Create or edit a savings goal: what it's for, how much, by when (optional)
 * and, optionally, the account it lives in. Linked, the account's balance is
 * what's saved; unlinked, the user adds money to it by hand.
 */
export function GoalDialog({ open, onOpenChange, goal }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Keyed, so each opening starts from the goal's current values. */}
      {open && <GoalForm key={goal?.id ?? "new"} goal={goal} onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function GoalForm({ goal, onDone }: { goal?: SavingsGoal; onDone: () => void }) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(reducer, goal, initialState);
  const set = <K extends keyof State>(field: K, value: State[K]) =>
    dispatch({ type: "set", field, value } as Action);
  const { data: accountsData } = useQuery<AccountsData>(ACCOUNTS_QUERY);
  const { main } = useCurrencies();
  const accounts = accountsData?.accounts ?? [];
  const linked = accounts.find((a) => a.id === state.accountId);
  const currency = linked?.currency ?? goal?.currency ?? main;

  const options = { refetchQueries: ["SavingsGoals"], awaitRefetchQueries: true };
  const [createGoal, creating] = useMutation(CREATE_SAVINGS_GOAL_MUTATION, options);
  const [updateGoal, updating] = useMutation(UPDATE_SAVINGS_GOAL_MUTATION, options);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const targetMinor = parseMoneyInput(state.target, currency);
    if (!state.name.trim()) return set("error", t("finance.goals.dialog.nameRequired"));
    if (!targetMinor || targetMinor <= 0) {
      return set("error", t("finance.goals.dialog.enterTarget"));
    }
    const savedMinor = state.saved.trim() ? parseMoneyInput(state.saved, currency) : null;
    if (state.saved.trim() && (savedMinor === null || savedMinor < 0)) {
      return set("error", t("finance.goals.dialog.enterSaved"));
    }
    const input = {
      name: state.name.trim(),
      emoji: state.emoji.trim() || null,
      targetMinor,
      deadline: state.deadline || null,
      accountId: state.accountId || null,
    };
    try {
      if (goal) {
        await updateGoal({ variables: { id: goal.id, input, today: todayIsoDate() } });
      } else {
        await createGoal({
          variables: {
            input: { ...input, savedMinor: state.accountId ? undefined : (savedMinor ?? 0) },
            today: todayIsoDate(),
          },
        });
      }
      onDone();
    } catch (err) {
      set("error", err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  return (
    <DialogContent>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <DialogHeader>
          <DialogTitle>
            {goal ? t("finance.goals.dialog.editTitle") : t("finance.goals.dialog.newTitle")}
          </DialogTitle>
          <DialogDescription>{t("finance.goals.dialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[4.5rem_1fr] gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-emoji">{t("finance.goals.dialog.emoji")}</Label>
            <Input
              id="goal-emoji"
              value={state.emoji}
              maxLength={16}
              placeholder="🏝️"
              className="text-center"
              onChange={(e) => set("emoji", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-name">{t("finance.goals.dialog.name")}</Label>
            <Input
              id="goal-name"
              value={state.name}
              maxLength={60}
              placeholder={t("finance.goals.dialog.namePlaceholder")}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-target">{t("finance.goals.dialog.target")}</Label>
            <MoneyInput
              id="goal-target"
              currency={currency}
              value={state.target}
              onChange={(e) => set("target", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-deadline">
              {t("finance.goals.dialog.deadline")}{" "}
              <span className="font-normal text-muted-foreground">({t("common.optional")})</span>
            </Label>
            <Input
              id="goal-deadline"
              type="date"
              min={todayIsoDate()}
              value={state.deadline}
              onChange={(e) => set("deadline", e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="goal-account">{t("finance.goals.dialog.account")}</Label>
          <select
            id="goal-account"
            className={selectClass}
            aria-describedby="goal-account-hint"
            value={state.accountId}
            onChange={(e) => set("accountId", e.target.value)}
          >
            <option value="">{t("finance.goals.dialog.noAccount")}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </select>
          <p id="goal-account-hint" className="text-xs text-muted-foreground">
            {state.accountId
              ? t("finance.goals.dialog.linkedHint")
              : t("finance.goals.dialog.unlinkedHint")}
          </p>
        </div>

        {!goal && !state.accountId && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal-saved">{t("finance.goals.dialog.alreadySaved")}</Label>
            <MoneyInput
              id="goal-saved"
              currency={currency}
              value={state.saved}
              placeholder="0"
              onChange={(e) => set("saved", e.target.value)}
            />
          </div>
        )}

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={creating.loading || updating.loading}>
            {goal ? t("common.save") : t("finance.goals.dialog.create")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
