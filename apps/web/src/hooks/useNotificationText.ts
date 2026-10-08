import { useTranslation } from "react-i18next";
import type { AchievementKey, AppNotification, Category } from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { daysBetween, formatMonthName, formatShortDate, todayIsoDate } from "#lib/dates";
import { levelTitle } from "#lib/levels";
import { formatMoney } from "#lib/money";

/** A notification in words: a headline and, for most kinds, a line of detail. */
export interface NotificationText {
  title: string;
  detail: string | null;
}

/**
 * Words for a notification from its `kind` and `params`, in the app's
 * language. The API stores what happened, never the sentence, so switching
 * language rewords the whole inbox.
 */
export function useNotificationText(): (n: AppNotification) => NotificationText {
  const { t } = useTranslation();
  const categoryName = useCategoryName();

  return ({ kind, params: p }) => {
    const str = (key: string) => String(p[key] ?? "");
    const num = (key: string) => Number(p[key] ?? 0);
    const money = (key: string) => formatMoney(num(key), str("currency") || "GBP");
    const habit = [str("icon"), str("habit")].filter(Boolean).join(" ");

    switch (kind) {
      case "task.dueToday":
        return {
          title: t("notifications.kinds.taskDueToday", {
            taskKey: str("taskKey"),
            title: str("title"),
          }),
          detail: t("notifications.kinds.taskDueDetail"),
        };
      case "task.overdue":
        return {
          title: t("notifications.kinds.taskOverdue", {
            taskKey: str("taskKey"),
            title: str("title"),
          }),
          detail: t("notifications.kinds.taskOverdueDetail", {
            date: formatShortDate(str("dueOn")),
          }),
        };
      case "task.inbox":
        return {
          title: t("notifications.kinds.taskInbox", { count: num("count") }),
          detail: t("notifications.kinds.taskInboxDetail", { count: num("count") }),
        };
      case "money.toReview":
        return {
          title: t("notifications.kinds.moneyToReview", { count: num("count") }),
          detail: t("notifications.kinds.moneyToReviewDetail", { count: num("count") }),
        };
      case "money.pendingCharges":
        return {
          title: t("notifications.kinds.moneyPendingCharges", { count: num("count") }),
          detail: t("notifications.kinds.moneyPendingChargesDetail", { count: num("count") }),
        };
      case "money.budget": {
        const category = p.category as Pick<Category, "name" | "key"> & { icon?: string | null };
        const name = [category?.icon, categoryName(category)].filter(Boolean).join(" ");
        const available = num("availableMinor");
        const percent = available > 0 ? Math.round((num("spentMinor") / available) * 100) : 100;
        return {
          title:
            str("level") === "reached"
              ? t("notifications.kinds.moneyBudgetReached", { category: name })
              : t("notifications.kinds.moneyBudgetNear", { category: name, percent }),
          detail: t("notifications.kinds.moneyBudgetDetail", {
            spent: money("spentMinor"),
            available: money("availableMinor"),
            month: formatMonthName(str("month")),
          }),
        };
      }
      case "money.cardDue": {
        const days = daysBetween(todayIsoDate(), str("dueDate"));
        const when =
          days <= 0
            ? t("common.today").toLocaleLowerCase()
            : days === 1
              ? t("common.tomorrow").toLocaleLowerCase()
              : t("common.inDays", { count: days });
        return {
          title: t("notifications.kinds.moneyCardDue", { account: str("account"), when }),
          detail: t("notifications.kinds.moneyCardDueDetail", { owed: money("owedMinor") }),
        };
      }
      case "money.goalReached":
        return {
          title: t("notifications.kinds.moneyGoalReached", {
            name: [str("emoji"), str("name")].filter(Boolean).join(" "),
          }),
          detail: null,
        };
      case "habit.due":
        return {
          title: t("notifications.kinds.habitDue", { habit }),
          detail: t("notifications.kinds.habitDueDetail", { time: str("startTime") }),
        };
      case "habit.streakAtRisk":
        return {
          title: t("notifications.kinds.habitStreakAtRisk", { habit, streak: num("streak") }),
          detail: t("notifications.kinds.habitStreakAtRiskDetail"),
        };
      case "habit.streakMilestone":
        return {
          title: t("notifications.kinds.habitStreakMilestone", { habit, streak: num("streak") }),
          detail: t("notifications.kinds.habitStreakMilestoneDetail"),
        };
      case "achievement.unlocked": {
        const key = str("achievement") as AchievementKey;
        return {
          title: t("notifications.kinds.achievementUnlocked", {
            badge: t(`habits.achievements.${key}.name`, { defaultValue: key }),
          }),
          detail: t(`habits.achievements.${key}.how`, { defaultValue: "" }) || null,
        };
      }
      case "achievement.levelUp":
        return {
          title: t("notifications.kinds.achievementLevelUp", { level: num("level") }),
          detail: t("notifications.kinds.achievementLevelUpDetail", {
            title: levelTitle(t, num("level")),
          }),
        };
      case "achievement.challengeWon":
        return {
          title: t("notifications.kinds.achievementChallengeWon", { habit: str("habit") }),
          detail: t("notifications.kinds.achievementChallengeWonDetail", { target: num("target") }),
        };
      default:
        return { title: t("notifications.kinds.unknown"), detail: null };
    }
  };
}
