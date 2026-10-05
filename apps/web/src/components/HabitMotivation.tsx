import { useMutation, useQuery } from "@apollo/client/react";
import { Snowflake, Swords, Trash2 } from "lucide-react";
import { type FormEvent, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import { Progress } from "#components/ui/progress";
import {
  CHALLENGES_QUERY,
  CREATE_CHALLENGE_MUTATION,
  DELETE_CHALLENGE_MUTATION,
  FREEZE_HABIT_DAY_MUTATION,
  HABITS_QUERY,
  HABIT_PROGRESS_REFETCH,
  POINTS_WALLET_QUERY,
  UNFREEZE_HABIT_DAY_MUTATION,
} from "#graphql/habits";
import type { Habit, HabitChallenge, PointsWallet } from "#graphql/types";
import { addDays, formatShortDate, startOfWeek, todayIsoDate } from "#lib/dates";
import { toast } from "#lib/toast";

const selectClass =
  "flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

/** How many days back a missed day can be frozen (as the API's FREEZE_WINDOW_DAYS). */
const FREEZE_WINDOW_DAYS = 7;

const refetchQueries = [{ query: HABITS_QUERY }, "HabitDetail", ...HABIT_PROGRESS_REFETCH];

/**
 * Spend points to buy back a missed day from the last week (so the streak
 * survives it), and undo a freeze for a refund.
 */
export function StreakFreezes({ habit }: { habit: Habit }) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const { data } = useQuery<{ pointsWallet: PointsWallet }>(POINTS_WALLET_QUERY, {
    variables: { today },
  });
  const [freeze, freezing] = useMutation(FREEZE_HABIT_DAY_MUTATION, { refetchQueries });
  const [unfreeze] = useMutation(UNFREEZE_HABIT_DAY_MUTATION, { refetchQueries });
  const wallet = data?.pointsWallet;
  const recent = habit.heatmap.filter(
    (d) => d.date < today && d.date >= addDays(today, -FREEZE_WINDOW_DAYS),
  );
  const missed = recent.filter((d) => d.status === "MISSED" || d.status === "SLIPPED");
  const frozen = recent.filter((d) => d.status === "FROZEN");

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Snowflake className="size-4 text-sky-500" /> {t("habits.freeze.title")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("habits.freeze.hint", { cost: wallet?.freezeCost ?? 50, days: FREEZE_WINDOW_DAYS })}
          {wallet && ` ${t("habits.freeze.balance", { balance: wallet.balance })}`}
        </p>
      </div>
      {missed.length === 0 && frozen.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("habits.freeze.nothing")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {missed.map((day) => (
            <li key={day.date} className="flex items-center justify-between gap-2">
              <span>
                {formatShortDate(day.date)} ·{" "}
                <span className="text-muted-foreground">
                  {day.status === "SLIPPED"
                    ? t("habits.detail.statusSlipped")
                    : t("habits.detail.statusMissed")}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={freezing.loading || (wallet ? wallet.balance < wallet.freezeCost : true)}
                onClick={() =>
                  freeze({ variables: { habitId: habit.id, date: day.date, today } }).catch(
                    (err: Error) => toast(err.message),
                  )
                }
              >
                <Snowflake className="size-3.5" />
                {t("habits.freeze.freeze", { cost: wallet?.freezeCost ?? 50 })}
              </Button>
            </li>
          ))}
          {frozen.map((day) => (
            <li key={day.date} className="flex items-center justify-between gap-2">
              <span>
                {formatShortDate(day.date)} ·{" "}
                <span className="text-sky-700 dark:text-sky-400">{t("habits.freeze.frozen")}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => unfreeze({ variables: { habitId: habit.id, date: day.date } })}
              >
                {t("habits.freeze.unfreeze")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface ChallengeForm {
  length: "week" | "7" | "14";
  target: string;
  multiplier: string;
  error: string | null;
}

type ChallengeAction = {
  [K in keyof ChallengeForm]: { type: "set"; field: K; value: ChallengeForm[K] };
}[keyof ChallengeForm];

function challengeReducer(state: ChallengeForm, action: ChallengeAction): ChallengeForm {
  return { ...state, [action.field]: action.value };
}

/** The range a length choice means, from today. */
function rangeFor(length: ChallengeForm["length"], today: string) {
  if (length === "week") return { startDate: today, endDate: addDays(startOfWeek(today), 6) };
  return { startDate: today, endDate: addDays(today, Number(length) - 1) };
}

/** This habit's current challenge with its progress, or a form to start one. */
export function HabitChallengeCard({ habit }: { habit: Habit }) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const { data } = useQuery<{ challenges: HabitChallenge[] }>(CHALLENGES_QUERY, {
    variables: { today },
  });
  const [form, dispatch] = useReducer(challengeReducer, {
    length: "week",
    target: "5",
    multiplier: "2",
    error: null,
  });
  const set = <K extends keyof ChallengeForm>(field: K, value: ChallengeForm[K]) =>
    dispatch({ type: "set", field, value } as ChallengeAction);
  const [create, creating] = useMutation(CREATE_CHALLENGE_MUTATION, { refetchQueries });
  const [remove] = useMutation(DELETE_CHALLENGE_MUTATION, { refetchQueries });
  const mine = (data?.challenges ?? []).filter((c) => c.habitId === habit.id);
  const current = mine.find(
    (c) =>
      c.status === "ACTIVE" ||
      c.status === "UPCOMING" ||
      (c.status === "WON" && c.endDate >= today),
  );
  const range = rangeFor(form.length, today);

  async function start(e: FormEvent) {
    e.preventDefault();
    const target = Number(form.target);
    if (!Number.isInteger(target) || target < 1)
      return set("error", t("habits.challenge.enterTarget"));
    try {
      await create({
        variables: {
          habitId: habit.id,
          input: { ...range, target, multiplier: Number(form.multiplier) },
          today,
        },
      });
      set("error", null);
    } catch (err) {
      set("error", err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Swords className="size-4 text-violet-500" /> {t("habits.challenge.title")}
        </h3>
        <p className="text-xs text-muted-foreground">{t("habits.challenge.hint")}</p>
      </div>
      {current ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            {t("habits.challenge.summary", {
              target: current.target,
              end: formatShortDate(current.endDate),
              multiplier: current.multiplier,
            })}
          </p>
          <Progress value={Math.min(100, (current.done / current.target) * 100)} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {current.status === "WON"
                ? t("habits.challenge.won", { points: current.bonusPoints })
                : t("habits.challenge.progress", { done: current.done, target: current.target })}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => remove({ variables: { id: current.id } })}
            >
              <Trash2 className="size-3.5" /> {t("habits.challenge.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={start} className="flex flex-wrap items-end gap-2" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="challenge-target">{t("habits.challenge.checkIns")}</Label>
            <Input
              id="challenge-target"
              type="number"
              min={1}
              max={31}
              className="w-20"
              value={form.target}
              onChange={(e) => set("target", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="challenge-length">{t("habits.challenge.within")}</Label>
            <select
              id="challenge-length"
              className={selectClass}
              value={form.length}
              onChange={(e) => set("length", e.target.value as ChallengeForm["length"])}
            >
              <option value="week">{t("habits.challenge.thisWeek")}</option>
              <option value="7">{t("habits.challenge.days", { count: 7 })}</option>
              <option value="14">{t("habits.challenge.days", { count: 14 })}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="challenge-multiplier">{t("habits.challenge.reward")}</Label>
            <select
              id="challenge-multiplier"
              className={selectClass}
              value={form.multiplier}
              onChange={(e) => set("multiplier", e.target.value)}
            >
              {["1.5", "2", "3"].map((m) => (
                <option key={m} value={m}>
                  {t("habits.challenge.multiplier", { multiplier: m })}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={creating.loading}>
            {t("habits.challenge.start")}
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            {t("habits.challenge.range", {
              from: formatShortDate(range.startDate),
              to: formatShortDate(range.endDate),
            })}
          </p>
          {form.error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {form.error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
