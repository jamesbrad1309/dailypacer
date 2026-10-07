import { useMutation, useQuery } from "@apollo/client/react";
import { Award, Coins, Gift, Lock, Plus, Snowflake, Swords, Trash2, Undo2 } from "lucide-react";
import { type FormEvent, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { ListSkeleton } from "#components/layout/Skeletons";
import { Button } from "#components/ui/button";
import { Card, CardContent } from "#components/ui/card";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import { Progress } from "#components/ui/progress";
import {
  ACHIEVEMENTS_QUERY,
  CHALLENGES_QUERY,
  CREATE_REWARD_MUTATION,
  DELETE_REWARD_MUTATION,
  POINTS_WALLET_QUERY,
  REDEEM_REWARD_MUTATION,
  REWARDS_QUERY,
  UNDO_POINTS_SPEND_MUTATION,
} from "#graphql/habits";
import type { Achievement, HabitChallenge, PointsWallet, Reward } from "#graphql/types";
import { formatDaysAgo, formatShortDate, todayIsoDate } from "#lib/dates";
import { toast } from "#lib/toast";
import { cn } from "#lib/utils";

const ACHIEVEMENT_EMOJI: Record<Achievement["key"], string> = {
  FIRST_CHECK_IN: "🌱",
  STREAK_7: "🔥",
  PERFECT_WEEK: "⭐",
  CHALLENGE_WON: "⚔️",
  STREAK_30: "🏅",
  CHECK_INS_100: "💯",
  LEVEL_5: "🎖️",
  STREAK_100: "🏆",
  CHECK_INS_500: "💎",
};

const WALLET_REFETCH = ["PointsWallet", "Rewards"];

/**
 * What habits earn: the points wallet (every check-in ever, spent on
 * rewards and streak freezes), achievements, challenges, and the reward
 * shop the user stocks with their own treats.
 */
export function RewardsView() {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const { data, loading } = useQuery<{ pointsWallet: PointsWallet }>(POINTS_WALLET_QUERY, {
    variables: { today },
  });
  const wallet = data?.pointsWallet;

  if (loading && !wallet) return <ListSkeleton rows={4} />;
  return (
    <div className="flex flex-col gap-6">
      {wallet && (
        <div className="grid grid-cols-3 gap-4">
          <Tile
            icon={<Coins className="size-4 text-amber-500" />}
            label={t("habits.rewards.balance")}
            value={wallet.balance}
            strong
          />
          <Tile
            icon={<Plus className="size-4 text-emerald-500" />}
            label={t("habits.rewards.earned")}
            value={wallet.earned}
          />
          <Tile
            icon={<Gift className="size-4 text-violet-500" />}
            label={t("habits.rewards.spent")}
            value={wallet.spent}
          />
        </div>
      )}
      <p className="-mt-3 text-xs text-muted-foreground">{t("habits.rewards.howPoints")}</p>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Shop balance={wallet?.balance ?? 0} />
        <Challenges />
      </div>
      <Achievements />
      {wallet && <History wallet={wallet} />}
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  strong,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className={cn("font-semibold tabular-nums", strong ? "text-3xl" : "text-2xl")}>
          {value.toLocaleString()}
        </span>
      </CardContent>
    </Card>
  );
}

interface RewardForm {
  name: string;
  emoji: string;
  cost: string;
  error: string | null;
}

type RewardAction =
  | { [K in keyof RewardForm]: { type: "set"; field: K; value: RewardForm[K] } }[keyof RewardForm]
  | { type: "added" };

function rewardReducer(state: RewardForm, action: RewardAction): RewardForm {
  if (action.type === "added") return { name: "", emoji: "", cost: "", error: null };
  return { ...state, [action.field]: action.value };
}

function Shop({ balance }: { balance: number }) {
  const { t } = useTranslation();
  const today = todayIsoDate();
  const { data } = useQuery<{ rewards: Reward[] }>(REWARDS_QUERY);
  const [form, dispatch] = useReducer(rewardReducer, {
    name: "",
    emoji: "",
    cost: "",
    error: null,
  });
  const set = <K extends keyof RewardForm>(field: K, value: RewardForm[K]) =>
    dispatch({ type: "set", field, value } as RewardAction);
  const options = { refetchQueries: WALLET_REFETCH, awaitRefetchQueries: true };
  const [create, creating] = useMutation(CREATE_REWARD_MUTATION, options);
  const [remove] = useMutation(DELETE_REWARD_MUTATION, options);
  const [redeem, redeeming] = useMutation<{ redeemReward: { id: string } }>(
    REDEEM_REWARD_MUTATION,
    options,
  );
  const [undo] = useMutation(UNDO_POINTS_SPEND_MUTATION, options);
  const rewards = data?.rewards ?? [];

  async function add(e: FormEvent) {
    e.preventDefault();
    const cost = Number(form.cost);
    if (!form.name.trim()) return set("error", t("habits.rewards.nameRequired"));
    if (!Number.isInteger(cost) || cost < 1) return set("error", t("habits.rewards.costRequired"));
    try {
      await create({
        variables: { input: { name: form.name.trim(), emoji: form.emoji.trim() || null, cost } },
      });
      dispatch({ type: "added" });
    } catch (err) {
      set("error", err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  async function buy(reward: Reward) {
    try {
      const result = await redeem({ variables: { id: reward.id, today } });
      const spendId = result.data?.redeemReward.id;
      toast(t("habits.rewards.redeemed", { name: reward.name, cost: reward.cost }), {
        actions: spendId
          ? [{ label: t("common.undo"), onClick: () => undo({ variables: { id: spendId } }) }]
          : [],
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-labelledby="shop">
      <div>
        <h2 id="shop" className="flex items-center gap-1.5 text-base font-semibold">
          <Gift className="size-4 text-violet-500" /> {t("habits.rewards.shop")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("habits.rewards.shopHint")}</p>
      </div>
      {rewards.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("habits.rewards.noRewards")}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {rewards.map((reward) => {
            const short = reward.cost - balance;
            return (
              <li key={reward.id} className="flex items-center gap-3 py-2">
                <span aria-hidden className="w-6 text-center text-lg">
                  {reward.emoji ?? "🎁"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{reward.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("habits.rewards.cost", { cost: reward.cost })}
                    {reward.timesRedeemed > 0 &&
                      ` · ${t("habits.rewards.times", { count: reward.timesRedeemed })}`}
                  </span>
                </span>
                <Button
                  size="sm"
                  disabled={short > 0 || redeeming.loading}
                  onClick={() => buy(reward)}
                >
                  {short > 0 ? (
                    <>
                      <Lock className="size-3.5" /> {t("habits.rewards.needMore", { count: short })}
                    </>
                  ) : (
                    t("habits.rewards.redeem")
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={t("habits.rewards.remove", { name: reward.name })}
                  onClick={() => remove({ variables: { id: reward.id } })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 border-t pt-3" noValidate>
        <div className="flex w-16 flex-col gap-1.5">
          <Label htmlFor="reward-emoji">{t("habits.rewards.emoji")}</Label>
          <Input
            id="reward-emoji"
            value={form.emoji}
            maxLength={16}
            placeholder="🍕"
            className="text-center"
            onChange={(e) => set("emoji", e.target.value)}
          />
        </div>
        <div className="flex min-w-40 flex-1 flex-col gap-1.5">
          <Label htmlFor="reward-name">{t("habits.rewards.name")}</Label>
          <Input
            id="reward-name"
            value={form.name}
            maxLength={80}
            placeholder={t("habits.rewards.namePlaceholder")}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="reward-cost">{t("habits.rewards.points")}</Label>
          <Input
            id="reward-cost"
            type="number"
            min={1}
            value={form.cost}
            placeholder="500"
            onChange={(e) => set("cost", e.target.value)}
          />
        </div>
        <Button type="submit" disabled={creating.loading}>
          <Plus className="size-4" /> {t("habits.rewards.add")}
        </Button>
        {form.error && (
          <p role="alert" className="w-full text-sm text-destructive">
            {form.error}
          </p>
        )}
      </form>
    </section>
  );
}

function Challenges() {
  const { t } = useTranslation();
  const { data } = useQuery<{ challenges: HabitChallenge[] }>(CHALLENGES_QUERY, {
    variables: { today: todayIsoDate() },
  });
  const challenges = data?.challenges ?? [];
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
      aria-labelledby="challenges"
    >
      <div>
        <h2 id="challenges" className="flex items-center gap-1.5 text-base font-semibold">
          <Swords className="size-4 text-violet-500" /> {t("habits.challenge.listTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("habits.challenge.listHint")}</p>
      </div>
      {challenges.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("habits.challenge.none")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {challenges.map((c) => (
            <li key={c.id} className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{c.habitName}</span>
                <span
                  className={cn(
                    "text-xs",
                    c.status === "WON"
                      ? "text-status-good"
                      : c.status === "LOST"
                        ? "text-muted-foreground"
                        : "",
                  )}
                >
                  {t(`habits.challenge.status.${c.status}`)}
                </span>
              </div>
              <Progress value={Math.min(100, (c.done / c.target) * 100)} className="h-1.5" />
              <span className="text-xs text-muted-foreground">
                {t("habits.challenge.line", {
                  done: c.done,
                  target: c.target,
                  from: formatShortDate(c.startDate),
                  to: formatShortDate(c.endDate),
                  multiplier: c.multiplier,
                })}
                {c.bonusPoints > 0 && ` · +${c.bonusPoints}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Achievements() {
  const { t } = useTranslation();
  const { data } = useQuery<{ achievements: Achievement[] }>(ACHIEVEMENTS_QUERY, {
    variables: { today: todayIsoDate() },
  });
  const list = data?.achievements ?? [];
  const unlocked = list.filter((a) => a.unlocked).length;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="achievements">
      <h2 id="achievements" className="flex items-center gap-1.5 text-base font-semibold">
        <Award className="size-4 text-amber-500" /> {t("habits.achievements.title")}
        <span className="text-sm font-normal text-muted-foreground">
          {unlocked}/{list.length}
        </span>
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((a) => (
          <li
            key={a.key}
            className={cn(
              "flex items-start gap-3 rounded-xl border bg-card p-3",
              !a.unlocked && "opacity-75",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full text-xl",
                a.unlocked ? "bg-amber-500/15" : "bg-muted grayscale",
              )}
            >
              {ACHIEVEMENT_EMOJI[a.key]}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm font-medium">
                {t(`habits.achievements.${a.key}.name`)}
                {!a.unlocked && (
                  <span className="sr-only"> ({t("habits.achievements.locked")})</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`habits.achievements.${a.key}.how`)}
              </span>
              {a.unlocked ? (
                <span className="text-xs text-status-good">
                  {a.achievedOn
                    ? t("habits.achievements.unlockedOn", { date: formatShortDate(a.achievedOn) })
                    : t("habits.achievements.unlocked")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Progress value={(a.progress / a.target) * 100} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {a.progress}/{a.target}
                  </span>
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function History({ wallet }: { wallet: PointsWallet }) {
  const { t } = useTranslation();
  const [undo] = useMutation(UNDO_POINTS_SPEND_MUTATION, {
    refetchQueries: [...WALLET_REFETCH, "HabitDetail", "Habits"],
  });
  if (wallet.spends.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="spends">
      <h2 id="spends" className="text-base font-semibold">
        {t("habits.rewards.history")}
      </h2>
      <ul className="divide-y rounded-xl border bg-card">
        {wallet.spends.map((spend) => (
          <li key={spend.id} className="flex items-center gap-3 px-4 py-2 text-sm">
            {spend.kind === "freeze" ? (
              <Snowflake
                className="size-4 text-sky-500"
                aria-label={t("habits.rewards.freezeSpend")}
              />
            ) : (
              <Gift
                className="size-4 text-violet-500"
                aria-label={t("habits.rewards.rewardSpend")}
              />
            )}
            <span className="min-w-0 flex-1 truncate">{spend.label}</span>
            <span className="text-xs text-muted-foreground">{formatDaysAgo(spend.createdAt)}</span>
            <span className="tabular-nums">−{spend.points}</span>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={t("habits.rewards.undo", { label: spend.label })}
              onClick={() => undo({ variables: { id: spend.id } })}
            >
              <Undo2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
