/**
 * Demo data that keeps its shape in time: every date is stored as a day
 * offset from the import day (`day: -3` is three days before it), and
 * budget months as month offsets, so an import a year from now still has
 * yesterday's coffee, last week's runs and this month's budget.
 * Written by `demo:export`, read by `demo:import` (docs/infra/demo-data.md).
 */

export const DEMO_VERSION = 1;

/**
 * A category: a seeded one's `key` ("coffee"), or the name of one of the
 * user's own (listed in `categories`).
 */
export type CategoryRef = string;

export interface DemoCategory {
  name: string;
  kind: "expense" | "income";
  icon?: string | null;
  /** A top-level category of the same kind. */
  parent?: CategoryRef | null;
}

/** The create-account input, with the opening day as an offset. */
export interface DemoAccount {
  /** How transactions, transfers and goals point at it. */
  ref: string;
  name: string;
  type: "CURRENT" | "SAVINGS" | "CASH" | "INVESTMENT" | "CREDIT_CARD" | "LOAN" | "IOU";
  currency?: string;
  institution?: string | null;
  last4?: string | null;
  icon?: string | null;
  color?: string | null;
  /** As entered: what's owed is positive for cards, loans and IOUs. */
  currentBalanceMinor: number;
  openedDay: number;
  owedByMe?: boolean;
  creditLimitMinor?: number;
  statementDay?: number | null;
  paymentDueDay?: number | null;
  minPaymentMinor?: number | null;
  aprBps?: number | null;
  monthlyPaymentMinor?: number | null;
  loanStartDay?: number | null;
  termMonths?: number | null;
  archived?: boolean;
}

export interface DemoBudget {
  category: CategoryRef;
  /** 0 is the import month, -1 the month before. */
  month: number;
  /** null: no budget from this month on (earlier months keep theirs). */
  amountMinor: number | null;
  rollover?: boolean;
}

export interface DemoTransaction {
  account: string;
  day: number;
  /** Negative = money out. With `shares`, the whole bill. */
  amountMinor: number;
  category?: CategoryRef | null;
  payee?: string | null;
  note?: string | null;
  tags?: string[];
  /** How it was logged; "quick" and "form" tick the log-today habit. */
  source?: "form" | "quick" | "import";
  status?: "CLEARED" | "PENDING";
  /** Split across categories; the parts add up to `amountMinor` (your share, for a shared bill). */
  splits?: { category: CategoryRef; amountMinor: number; note?: string | null }[];
  /**
   * "Split with…": other people's shares (IOU account refs), positive. The
   * bill comes back as one linked group: your share as the expense, theirs
   * as transfers to their IOUs.
   */
  shares?: { account: string; amountMinor: number }[];
}

export interface DemoTransfer {
  from: string;
  to: string;
  day: number;
  /** Positive, in the source account's currency. */
  amountMinor: number;
  toAmountMinor?: number;
  note?: string | null;
}

export interface DemoHabitEntry {
  day: number;
  completed?: boolean;
  value?: number | null;
  note?: string | null;
}

export interface DemoHabit {
  name: string;
  createdDay: number;
  description?: string | null;
  tags?: string[];
  icon?: string | null;
  unit?: string | null;
  targetValue?: number | null;
  startTime?: string | null;
  schedule: unknown;
  polarity?: "build" | "avoid";
  endDay?: number | null;
  /** `type` and `options` as in habits/dto/create-habit.dto.ts; no type reads as text. */
  customFields?: { label: string; type?: string; value: string; options?: string[] }[];
  /** Ticked from transactions; such a habit's entries aren't stored, they're re-derived. */
  finance?: "NO_SPEND" | "LOGGED_TODAY" | null;
  /** Linked spending: its cost, and for no-spend what counts. */
  categories?: CategoryRef[];
  /** Paused from this day on. */
  pausedDay?: number | null;
  archived?: boolean;
  entries: DemoHabitEntry[];
}

export interface DemoGoal {
  name: string;
  emoji?: string | null;
  targetMinor: number;
  createdDay: number;
  deadlineDay?: number | null;
  /** Follows this account's balance. */
  account?: string | null;
  /** Unlinked: what was already put aside when it was made. */
  startingSavedMinor?: number;
  /** Its daily "save this much" habit, re-derived from contributions and transfers. */
  dailyHabitMinor?: number | null;
  archived?: boolean;
  /** Unlinked goals: money added (or taken out, negative) on a day. */
  contributions: { day: number; amountMinor: number }[];
}

export interface DemoJournalEntry {
  kind: "ACTION" | "FEELING" | "EVENT";
  time?: string | null;
  text: string;
  durationMinutes?: number | null;
  emotion?: string | null;
  intensity?: number | null;
  tone?: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
  /** The EVENT this came from: its position in the same day's list. */
  triggerIndex?: number | null;
}

export interface DemoJournalDay {
  day: number;
  entries: DemoJournalEntry[];
}

export interface DemoTask {
  title: string;
  notes?: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  createdDay: number;
  plannedDay?: number | null;
  dueDay?: number | null;
  /** DONE only: when it was finished. */
  doneDay?: number | null;
}

export interface DemoTodoList {
  /** "Inbox" fills the built-in Inbox instead of making a list. */
  name: string;
  prefix?: string;
  tasks: DemoTask[];
}

export interface DemoFixture {
  version: typeof DEMO_VERSION;
  /** For reading the file only: dates are offsets, so this day doesn't matter on import. */
  exportedOn: string;
  categories: DemoCategory[];
  accounts: DemoAccount[];
  budgets: DemoBudget[];
  transactions: DemoTransaction[];
  transfers: DemoTransfer[];
  habits: DemoHabit[];
  goals: DemoGoal[];
  journal: DemoJournalDay[];
  todoLists: DemoTodoList[];
}

const DAY_MS = 86_400_000;

/** The local calendar day, "YYYY-MM-DD": demo days follow the user's clock, not UTC. */
export function localToday(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `today` moved by `offset` days: dayAt("2026-10-07", -7) → "2026-09-30". */
export function dayAt(today: string, offset: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) + offset * DAY_MS).toISOString().slice(0, 10);
}

/** Days from `today` to `day`: negative in the past. */
export function offsetOf(today: string, day: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/** `today`'s month moved by `offset` months, "YYYY-MM". */
export function monthAt(today: string, offset: number): string {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 7);
}

/** Months from `today`'s month to `month` ("YYYY-MM"). */
export function monthOffsetOf(today: string, month: string): number {
  const [ty, tm] = today.split("-").map(Number);
  const [y, m] = month.split("-").map(Number);
  return (y - ty) * 12 + (m - tm);
}
