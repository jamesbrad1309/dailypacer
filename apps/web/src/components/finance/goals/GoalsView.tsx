import { useMutation, useQuery } from "@apollo/client/react";
import {
  Archive,
  ArchiveRestore,
  CircleAlert,
  CircleCheck,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";
import { type FormEvent, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { GoalDialog } from "#components/finance/goals/GoalDialog";
import { MoneyInput } from "#components/finance/MoneyInput";
import { ListSkeleton } from "#components/layout/Skeletons";
import { ConfirmPrompt } from "#components/todos/ConfirmPrompt";
import { Button } from "#components/ui/button";
import { Card } from "#components/ui/card";
import {
  CONTRIBUTE_TO_SAVINGS_GOAL_MUTATION,
  DELETE_SAVINGS_GOAL_MUTATION,
  SAVINGS_GOALS_QUERY,
  UPDATE_SAVINGS_GOAL_MUTATION,
} from "#graphql/finance";
import type { SavingsGoal, SavingsGoalsData } from "#graphql/types";
import { formatShortDate, todayIsoDate } from "#lib/dates";
import { formatMoney, parseMoneyInput } from "#lib/money";
import { cn } from "#lib/utils";

// A reached goal adds to the LifeOS level.
const REFETCH = { refetchQueries: ["SavingsGoals", "LifeLevel"], awaitRefetchQueries: true };

/**
 * Savings goals: progress towards each, whether it's keeping pace with its
 * deadline, and what to put aside each month to make it. Linked goals
 * follow their account's balance; the rest take money added by hand.
 */
export function GoalsView() {
  const { t } = useTranslation();
  const [showArchived, setShowArchived] = useState(false);
  const { data, loading, error } = useQuery<SavingsGoalsData>(SAVINGS_GOALS_QUERY, {
    variables: { today: todayIsoDate(), includeArchived: showArchived },
  });
  const [dialog, setDialog] = useState<{ goal?: SavingsGoal } | null>(null);

  if (loading && !data) return <ListSkeleton rows={3} />;
  if (error) return <p className="text-destructive">{error.message}</p>;
  const goals = data?.savingsGoals ?? [];
  const active = goals.filter((g) => !g.archivedAt);
  const archived = goals.filter((g) => g.archivedAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          {t("finance.goals.showArchived")}
        </label>
        <Button size="sm" className="ml-auto" onClick={() => setDialog({})}>
          <Plus className="size-4" /> {t("finance.goals.newGoal")}
        </Button>
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t("finance.goals.emptyTitle")}</p>
          <p className="mt-1">{t("finance.goals.emptyBody")}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onEdit={() => setDialog({ goal })} />
          ))}
        </div>
      )}

      {showArchived && archived.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t("finance.goals.archived")}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {archived.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onEdit={() => setDialog({ goal })} />
            ))}
          </div>
        </section>
      )}

      <GoalDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        goal={dialog?.goal}
      />
    </div>
  );
}

/** Where a goal stands, in words and an icon, never colour alone. */
function Status({ goal }: { goal: SavingsGoal }) {
  const { t } = useTranslation();
  if (goal.achieved) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-status-good">
        <Trophy className="size-3.5" aria-hidden /> {t("finance.goals.status.achieved")}
      </span>
    );
  }
  if (goal.overdue) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-status-critical">
        <CircleAlert className="size-3.5" aria-hidden /> {t("finance.goals.status.overdue")}
      </span>
    );
  }
  if (goal.onTrack === null) return null;
  return goal.onTrack ? (
    <span className="flex items-center gap-1 text-xs font-medium text-status-good">
      <CircleCheck className="size-3.5" aria-hidden /> {t("finance.goals.status.onTrack")}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-status-warning">
      <CircleAlert className="size-3.5" aria-hidden /> {t("finance.goals.status.behind")}
    </span>
  );
}

interface CardState {
  /** The add/take-out form: which way, and the amount typed. */
  moving: "add" | "remove" | null;
  amount: string;
  confirmingDelete: boolean;
  error: string | null;
}

type CardAction =
  | { type: "move"; direction: "add" | "remove" | null }
  | { type: "amount"; amount: string }
  | { type: "confirmDelete"; on: boolean }
  | { type: "error"; message: string | null };

function cardReducer(state: CardState, action: CardAction): CardState {
  switch (action.type) {
    case "move":
      return { ...state, moving: action.direction, amount: "", error: null };
    case "amount":
      return { ...state, amount: action.amount };
    case "confirmDelete":
      return { ...state, confirmingDelete: action.on, moving: null };
    case "error":
      return { ...state, error: action.message };
  }
}

function GoalCard({ goal, onEdit }: { goal: SavingsGoal; onEdit: () => void }) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(cardReducer, {
    moving: null,
    amount: "",
    confirmingDelete: false,
    error: null,
  });
  const [contribute, contributing] = useMutation(CONTRIBUTE_TO_SAVINGS_GOAL_MUTATION, REFETCH);
  const [updateGoal] = useMutation(UPDATE_SAVINGS_GOAL_MUTATION, REFETCH);
  const [deleteGoal, deleting] = useMutation(DELETE_SAVINGS_GOAL_MUTATION, REFETCH);
  const money = (minor: number) => formatMoney(minor, goal.currency);
  const percent = Math.round(goal.progress * 100);
  // Where a steady pace would be today, as a tick on the bar.
  const expectedShare =
    goal.expectedMinor !== null && !goal.achieved
      ? Math.min(1, Math.max(0, goal.expectedMinor / goal.targetMinor))
      : null;

  async function move(e: FormEvent) {
    e.preventDefault();
    const amountMinor = parseMoneyInput(state.amount, goal.currency);
    if (!amountMinor || amountMinor <= 0) {
      return dispatch({ type: "error", message: t("finance.goals.enterAmount") });
    }
    try {
      await contribute({
        variables: {
          id: goal.id,
          amountMinor: state.moving === "remove" ? -amountMinor : amountMinor,
          today: todayIsoDate(),
        },
      });
      dispatch({ type: "move", direction: null });
    } catch (err) {
      dispatch({ type: "error", message: err instanceof Error ? err.message : null });
    }
  }

  return (
    <Card className={cn("flex flex-col gap-3 p-4", goal.archivedAt && "opacity-70")}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-2xl leading-none">
          {goal.emoji ?? "🎯"}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{goal.name}</h3>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {goal.account && (
              <span className="flex items-center gap-1">
                <Landmark className="size-3" aria-hidden />
                {t("finance.goals.inAccount", { account: goal.account.name })}
              </span>
            )}
            {goal.deadline && (
              <span>{t("finance.goals.by", { date: formatShortDate(goal.deadline) })}</span>
            )}
          </p>
        </div>
        <Status goal={goal} />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
          <span>
            <span className="text-lg font-semibold">{money(goal.savedMinor)}</span>{" "}
            <span className="text-muted-foreground">
              {t("finance.goals.of", { target: money(goal.targetMinor) })}
            </span>
          </span>
          <span className="text-muted-foreground">{percent}%</span>
        </div>
        {/* The amounts and percentage above say it in words; the bar is a picture of them. */}
        <div aria-hidden className="relative mt-1.5 h-2 rounded-full bg-muted">
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full",
              goal.achieved || goal.onTrack !== false ? "bg-status-good" : "bg-status-warning",
            )}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
          {expectedShare !== null && (
            <div
              aria-hidden
              title={t("finance.goals.expectedTick", { amount: money(goal.expectedMinor ?? 0) })}
              className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-viz-reference ring-2 ring-card"
              style={{ left: `${expectedShare * 100}%` }}
            />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {goal.achieved
          ? t("finance.goals.reached")
          : goal.requiredPerMonthMinor !== null
            ? goal.overdue
              ? t("finance.goals.stillToSave", { amount: money(goal.remainingMinor) })
              : t("finance.goals.perMonth", {
                  amount: money(goal.requiredPerMonthMinor),
                  date: formatShortDate(goal.deadline ?? ""),
                })
            : t("finance.goals.toGo", { amount: money(goal.remainingMinor) })}
      </p>

      {state.moving && (
        <form onSubmit={move} className="flex flex-wrap items-center gap-2">
          <div className="min-w-28 flex-1">
            <MoneyInput
              currency={goal.currency}
              value={state.amount}
              autoFocus
              aria-label={
                state.moving === "add" ? t("finance.goals.addMoney") : t("finance.goals.takeOut")
              }
              onChange={(e) => dispatch({ type: "amount", amount: e.target.value })}
            />
          </div>
          <Button type="submit" size="sm" disabled={contributing.loading}>
            {state.moving === "add" ? t("finance.goals.addMoney") : t("finance.goals.takeOut")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => dispatch({ type: "move", direction: null })}
          >
            {t("common.cancel")}
          </Button>
        </form>
      )}
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}

      {state.confirmingDelete ? (
        <ConfirmPrompt
          message={`${t("finance.goals.deletePrompt", { name: goal.name })} ${t("todos.cannotUndo")}`}
          confirmLabel={t("common.delete")}
          busy={deleting.loading}
          onCancel={() => dispatch({ type: "confirmDelete", on: false })}
          onConfirm={() => deleteGoal({ variables: { id: goal.id } })}
        />
      ) : (
        <div className="mt-auto flex flex-wrap items-center gap-1 border-t pt-2">
          {!goal.account && !goal.archivedAt && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => dispatch({ type: "move", direction: "add" })}
              >
                <Plus className="size-3.5" /> {t("finance.goals.addMoney")}
              </Button>
              {goal.savedMinor > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dispatch({ type: "move", direction: "remove" })}
                >
                  {t("finance.goals.takeOut")}
                </Button>
              )}
            </>
          )}
          <div className="ml-auto flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={t("finance.goals.editGoal", { name: goal.name })}
              onClick={onEdit}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={
                goal.archivedAt
                  ? t("finance.goals.restoreGoal", { name: goal.name })
                  : t("finance.goals.archiveGoal", { name: goal.name })
              }
              onClick={() =>
                updateGoal({
                  variables: {
                    id: goal.id,
                    input: { archived: !goal.archivedAt },
                    today: todayIsoDate(),
                  },
                })
              }
            >
              {goal.archivedAt ? (
                <ArchiveRestore className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={t("finance.goals.deleteGoal", { name: goal.name })}
              onClick={() => dispatch({ type: "confirmDelete", on: true })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
