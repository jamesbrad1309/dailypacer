/**
 * Habits whose entries come from transactions instead of being ticked by
 * hand (docs/finance/habits-integration.md §1, §2 and §5). The habit says which
 * in `metadata.source`; the rules for one day live here, pure, so they're
 * easy to test.
 */

/** "No-spend day": an avoid habit, slipped on any day money went out. */
export const NO_SPEND = "finance.noSpend";
/** "Log today's spending": a build habit, done once anything is logged that day. */
export const LOGGED_TODAY = "finance.loggedToday";

/** A savings goal's daily "save X" habit: the day's check-in is what was put aside. */
export const SAVINGS_GOAL = "finance.savingsGoal";

export const FINANCE_HABIT_SOURCES = [NO_SPEND, LOGGED_TODAY, SAVINGS_GOAL] as const;
export type FinanceHabitSource = (typeof FINANCE_HABIT_SOURCES)[number];

export interface FinanceHabitLink {
  source: FinanceHabitSource;
  /** No-spend only: when set, only spending in these categories breaks the day (so rent doesn't). */
  categoryIds: string[] | null;
}

/** The finance link in a habit's metadata, or null for an ordinary habit. */
export function financeLinkOf(metadata: unknown): FinanceHabitLink | null {
  if (!metadata || typeof metadata !== "object") return null;
  const { source, categoryIds } = metadata as { source?: unknown; categoryIds?: unknown };
  if (!FINANCE_HABIT_SOURCES.includes(source as FinanceHabitSource)) return null;
  const ids = Array.isArray(categoryIds)
    ? categoryIds.filter((id): id is string => typeof id === "string")
    : [];
  return { source: source as FinanceHabitSource, categoryIds: ids.length > 0 ? ids : null };
}

/** What a day's transactions need to carry for these rules. */
export interface DayTransaction {
  amountMinor: number;
  source: string;
  transferId: string | null;
  categoryId: string | null;
  splits: { categoryId: string }[];
}

/**
 * Money spent: out of an account, and not a transfer (money moved, not
 * spent) or a balance adjustment (a correction, not a purchase). With
 * `categoryIds`, only spending in one of them counts; a split counts when
 * any of its parts is in one.
 */
export function isSpending(t: DayTransaction, categoryIds: readonly string[] | null): boolean {
  if (t.amountMinor >= 0 || t.transferId || t.source === "adjustment") return false;
  if (!categoryIds) return true;
  return (
    (t.categoryId !== null && categoryIds.includes(t.categoryId)) ||
    t.splits.some((s) => categoryIds.includes(s.categoryId))
  );
}

/**
 * Logged by hand: from quick log or the form, or a balance adjustment
 * (reconciling keeps the numbers right too). Imports, subscriptions and
 * transfers don't count; they aren't the evening routine.
 */
export function isLoggedByHand(t: Pick<DayTransaction, "source">): boolean {
  return t.source === "quick" || t.source === "form" || t.source === "adjustment";
}

/** What a linked habit's entry for one day should say. */
export type DerivedEntry =
  /** No-spend: `value` slips (spending transactions), 0 for a clean day. */
  { kind: "slips"; value: number } | { kind: "done"; completed: boolean };

/**
 * One day's entry for a linked habit. `reconciled` is a log-today day kept
 * by a reconcile that found nothing to adjust: no transaction shows it, so
 * the entry remembers it.
 */
export function derivedEntry(
  link: FinanceHabitLink,
  transactions: readonly DayTransaction[],
  reconciled: boolean,
): DerivedEntry {
  if (link.source === NO_SPEND) {
    return {
      kind: "slips",
      value: transactions.filter((t) => isSpending(t, link.categoryIds)).length,
    };
  }
  return { kind: "done", completed: reconciled || transactions.some(isLoggedByHand) };
}

/**
 * A savings habit's day: `value` is what was put aside in major units
 * (£10, so it reads against the habit's target), never negative. Done once
 * it reaches the target, or anything at all without one.
 */
export function savedEntry(
  savedMinor: number,
  digits: number,
  target: number | null,
): { value: number; completed: boolean } {
  const value = Math.max(0, savedMinor) / 10 ** digits;
  return { value, completed: target ? value >= target : value > 0 };
}

/**
 * What a goal got on one day: for a goal following an account, the net
 * of everything into and out of it (a transfer in, less any withdrawal);
 * for an unlinked one, its contributions.
 */
export function savedOnDay(
  goal: { accountId: string | null },
  transactions: readonly { accountId: string; amountMinor: number }[],
  contributions: readonly { amountMinor: number }[],
): number {
  const rows = goal.accountId
    ? transactions.filter((t) => t.accountId === goal.accountId)
    : contributions;
  return rows.reduce((sum, r) => sum + r.amountMinor, 0);
}

/**
 * The spending categories a habit is linked to (`metadata.categoryIds`):
 * what a no-spend habit counts, and what any habit shows as its cost.
 */
export function linkedCategoryIds(metadata: unknown): string[] {
  const ids = (metadata as { categoryIds?: unknown } | null)?.categoryIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

/** A category row from the spend report, as habitSpend reads it. */
export interface CategorySpendRow {
  category: { id: string; parentId: string | null } | null;
  spentMinor: number;
  previousSpentMinor: number;
}

/**
 * What a habit's linked categories cost this month and last: a linked
 * parent category brings its subcategories with it.
 */
export function habitSpend(
  categoryIds: readonly string[],
  rows: readonly CategorySpendRow[],
): { thisMonthMinor: number; lastMonthMinor: number } {
  const linked = rows.filter(
    ({ category }) =>
      category !== null &&
      (categoryIds.includes(category.id) ||
        (category.parentId !== null && categoryIds.includes(category.parentId))),
  );
  return {
    thisMonthMinor: linked.reduce((sum, r) => sum + r.spentMinor, 0),
    lastMonthMinor: linked.reduce((sum, r) => sum + r.previousSpentMinor, 0),
  };
}
