export type HabitSchedule =
  | { type: "daily" }
  | { type: "weekly"; daysOfWeek: number[] }
  | { type: "timesPerWeek"; count: number }
  | { type: "interval"; everyNDays: number };

export interface HabitEntry {
  id: string;
  value: number | null;
  completed: boolean;
  note: string | null;
}

/** How a habit went on a day; see the BFF's HabitDayStatus. */
export type HabitDayStatus =
  | "DONE"
  | "PARTIAL"
  | "SLIPPED"
  | "MISSED"
  | "DUE"
  | "FROZEN"
  | "PAUSED"
  | "OFF"
  | "NONE";

export interface HeatmapDay {
  date: string;
  completed: boolean;
  value: number | null;
  status: HabitDayStatus;
}

export type HabitPolarity = "BUILD" | "AVOID";

export interface HabitCustomField {
  label: string;
  value: string;
}

/**
 * NO_SPEND: an avoid habit, slipped on any day money went out.
 * LOGGED_TODAY: done once anything is logged by hand that day.
 * SAVINGS_GOAL: a goal's daily habit; the day's value is what was put aside.
 */
export type HabitFinanceSource = "NO_SPEND" | "LOGGED_TODAY" | "SAVINGS_GOAL";

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  /** Lowercased labels, see lib/tags.ts. */
  tags: string[];
  icon: string | null;
  /** A hex from lib/colors.ts: the card's accent and the heatmap's fill. */
  color: string | null;
  unit: string | null;
  targetValue: number | null;
  /** "HH:mm" (24h), or null for "anytime today" — see components/DayCalendar.tsx. */
  startTime: string | null;
  schedule: HabitSchedule;
  /** AVOID ("no sugar"): a due day counts as done unless a slip is logged. */
  polarity: HabitPolarity;
  /** A time-boxed habit's last day; it archives itself after. */
  endDate: string | null;
  customFields: HabitCustomField[];
  /** Ticked from transactions instead of by hand; see HabitCheck. */
  financeSource: HabitFinanceSource | null;
  /** NO_SPEND only: just spending in these categories breaks the day. Empty: all spending. */
  financeCategoryIds: string[];
  /** SAVINGS_GOAL only: the goal it saves for. */
  savingsGoalId: string | null;
  paused: boolean;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  points: number;
  level: number;
  levelTitle: string;
  todayEntry: HabitEntry | null;
  heatmap: HeatmapDay[];
}

export interface CompletionPeriod {
  from: string;
  to: string;
  due: number;
  done: number;
  rate: number | null;
}

export interface HabitInsightsData {
  habitInsights: {
    /** 0 = Monday … 6 = Sunday; null when too thin or flat to call. */
    best: number | null;
    worst: number | null;
    weekdays: { weekday: number; due: number; done: number; rate: number | null }[];
    thisMonth: CompletionPeriod;
    lastMonth: CompletionPeriod;
  };
}

export interface HabitDetailData {
  habit: Habit & { createdAt: string };
}

export type HabitRecordStatus =
  | "DONE"
  | "PARTIAL"
  | "NOT_DONE"
  | "MISSED"
  | "MISSED_WEEK"
  | "SLIPPED";
export type HabitRecordFilter = "ALL" | "DONE" | "NOT_DONE" | "MISSED";

/** One row of a habit's records: a stored entry, a missed day, or a missed week. */
export interface HabitRecord {
  /** "YYYY-MM-DD"; a missed week's last day. */
  date: string;
  status: HabitRecordStatus;
  entry: { id: string; value: number | null; note: string | null } | null;
  week: { start: string; end: string; done: number; target: number } | null;
}

export interface HabitRecordsData {
  habitRecords: {
    items: HabitRecord[];
    total: number;
    page: number;
    pageSize: number;
    counts: { all: number; done: number; notDone: number; missed: number };
    trackedSince: string;
    missesByWeek: boolean;
  };
}

export interface HabitsData {
  habits: Habit[];
}

export type ArchivedHabit = Pick<Habit, "id" | "name" | "icon"> & {
  /** ISO timestamp. */
  archivedAt: string;
};

export interface ArchivedHabitsData {
  archivedHabits: ArchivedHabit[];
}

export interface DashboardStats {
  totalHabits: number;
  pausedHabits: number;
  totalPoints: number;
  level: number;
  levelTitle: string;
  pointsIntoLevel: number;
  pointsForNextLevel: number;
  longestOverallStreak: number;
  activeStreakCount: number;
}

export interface HabitSpend {
  habitId: string;
  /** The main currency. */
  currency: string;
  thisMonthMinor: number;
  lastMonthMinor: number;
}

export interface LifeLevel {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  habitXp: number;
  financeXp: number;
  budgetXp: number;
  goalXp: number;
  loggingXp: number;
}

export interface DashboardStatsData {
  dashboardStats: DashboardStats;
}

export interface CreateHabitInput {
  name: string;
  icon?: string;
  unit?: string;
  targetValue?: number;
  startTime?: string;
  schedule: HabitSchedule;
}

export interface UpdateHabitInput {
  name?: string;
  icon?: string | null;
  unit?: string | null;
  targetValue?: number | null;
  startTime?: string | null;
  schedule?: HabitSchedule;
}

export type JournalEntryKind = "ACTION" | "FEELING" | "EVENT";
export type JournalTone = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export interface JournalTrigger {
  id: string;
  kind: JournalEntryKind;
  text: string;
  time: string | null;
  tags: string[];
  tone: JournalTone | null;
}

export interface JournalFeeling {
  date: string;
  emotion: string;
  intensity: number | null;
}

export interface JournalEntry {
  id: string;
  date: string;
  kind: JournalEntryKind;
  /** "HH:mm" (24h), or null for "sometime that day". */
  time: string | null;
  text: string;
  tags: string[];
  durationMinutes: number | null;
  emotion: string | null;
  intensity: number | null;
  tone: JournalTone | null;
  trigger: JournalTrigger | null;
}

export interface JournalEntriesData {
  journalEntries: JournalEntry[];
}

export interface JournalDayFeeling {
  emotion: string;
  /** 1–5, or null when not given. */
  intensity: number | null;
}

export interface JournalDay {
  date: string;
  actionCount: number;
  feelingCount: number;
  eventCount: number;
  emotions: string[];
  feelings: JournalDayFeeling[];
}

export interface JournalDaysData {
  journalDays: JournalDay[];
}

/** Full replacement — see JournalEntryInput in the BFF schema for per-kind rules. */
export interface JournalEntryInput {
  date: string;
  kind: JournalEntryKind;
  time: string | null;
  text: string;
  durationMinutes?: number | null;
  emotion?: string | null;
  intensity?: number | null;
  tone?: JournalTone | null;
  triggerId?: string | null;
}

/** One item of a composer list; `triggerIndex` points at an EVENT earlier in the same list. */
export interface JournalEntryDraft extends JournalEntryInput {
  triggerIndex?: number;
}

export type AccountType =
  | "CURRENT"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "LOAN"
  | "IOU"
  | "CASH"
  | "INVESTMENT";

/** Amounts are integer minor units; format them with lib/money.ts. Negative balance = owed. */
export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  institution: string | null;
  last4: string | null;
  sortOrder: number;
  isDefault: boolean;
  /** "YYYY-MM-DD" */
  openingBalanceDate: string;
  /** ISO timestamp */
  lastReconciledAt: string | null;
  /** In the account's own `currency`. */
  balanceMinor: number;
  /** In the main currency at today's rate; null without a rate. */
  balanceMainMinor: number | null;
  creditLimitMinor: number | null;
  statementDay: number | null;
  paymentDueDay: number | null;
  minPaymentMinor: number | null;
  availableCreditMinor: number | null;
  utilization: number | null;
  nextDueDate: string | null;
  currentStatementSpendMinor: number | null;
  aprBps: number | null;
  monthlyPaymentMinor: number | null;
  loanStartDate: string | null;
  termMonths: number | null;
  /** "YYYY-MM" */
  estimatedPayoffMonth: string | null;
  paymentCoversInterest: boolean | null;
  dueDate: string | null;
  archivedAt: string | null;
}

export interface NetWorth {
  /** The main currency. */
  currency: string;
  /** Currencies left out for want of a rate. */
  unconverted: string[];
  netWorthMinor: number;
  assetsMinor: number;
  liabilitiesMinor: number;
}

export interface AccountsData {
  accounts: Account[];
  archivedAccounts: Account[];
  netWorth: NetWorth;
}

export interface Category {
  id: string;
  name: string;
  /** An emoji. */
  icon: string | null;
  kind: "expense" | "income" | string;
  /** Lowercase words the quick-log parser also matches. */
  aliases: string[];
  /** Seeded categories: translate the name by this (see useCategoryName). Null for the user's own. */
  key: string | null;
  /** "#rrggbb", or null. */
  color: string | null;
  /** Categories nest one level: the top-level category this one is under. */
  parentId: string | null;
  archivedAt: string | null;
  sortOrder: number;
}

/** One part of a split transaction: same sign as the transaction. */
export interface TransactionSplit {
  id: string;
  amountMinor: number;
  note: string | null;
  category: Category;
}

export interface PayeeRule {
  id: string;
  /** "TESCO*": `*` matches anything; without one, matches anywhere in the payee. */
  pattern: string;
  sortOrder: number;
  category: Category;
}

export type BudgetAlert = "NEAR" | "REACHED";

export interface BudgetAlertNotice {
  level: BudgetAlert;
  spentMinor: number;
  availableMinor: number;
  currency: string;
  category: Category;
}

export interface TopPayee {
  payee: string;
  spentMinor: number;
  transactionCount: number;
}

export interface TopPayeesData {
  topPayees: { currency: string; unconverted: string[]; payees: TopPayee[] };
}

export interface NetWorthMonth {
  /** "YYYY-MM" */
  month: string;
  assetsMinor: number;
  liabilitiesMinor: number;
  netWorthMinor: number;
}

export interface NetWorthHistoryData {
  netWorthHistory: { currency: string; unconverted: string[]; months: NetWorthMonth[] };
}

export interface SavingsGoal {
  id: string;
  name: string;
  emoji: string | null;
  targetMinor: number;
  currency: string;
  /** "YYYY-MM-DD" or null. */
  deadline: string | null;
  startDate: string;
  archivedAt: string | null;
  savedMinor: number;
  remainingMinor: number;
  /** saved / target: 1 once reached. */
  progress: number;
  achieved: boolean;
  overdue: boolean;
  requiredPerMonthMinor: number | null;
  onTrack: boolean | null;
  expectedMinor: number | null;
  /** Linked: its balance is what's saved. */
  account: Pick<Account, "id" | "name" | "currency"> | null;
  /** The daily "save this much" habit's amount, or null without one. */
  dailyHabitMinor: number | null;
  habitId: string | null;
}

export interface SavingsGoalsData {
  savingsGoals: SavingsGoal[];
}

export type TransactionStatus = "CLEARED" | "PENDING";

export interface Transaction {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** Negative = money out. */
  amountMinor: number;
  payee: string | null;
  note: string | null;
  tags: string[];
  /** quick | form | import | recurring | adjustment */
  source: string;
  /** PENDING: logged but not confirmed as gone through; waits in "To review". */
  status: TransactionStatus;
  isTransfer: boolean;
  /** For a transfer: the other account. */
  transferAccount: Pick<Account, "id" | "name" | "currency"> | null;
  createdAt: string;
  account: Pick<Account, "id" | "name" | "currency">;
  category: Category | null;
  /** Split across categories: then `category` is null and these add up to the amount. */
  splits: TransactionSplit[];
  /** "Split with…": the whole bill, while amountMinor is your share; null otherwise. */
  sharedTotalMinor: number | null;
  /** Others' shares, added to what they owe you. */
  sharedWith: { amountMinor: number; account: Pick<Account, "id" | "name"> }[];
}

export interface TransactionFilter {
  accountId?: string | null;
  categoryId?: string | null;
  from?: string | null;
  to?: string | null;
  search?: string | null;
  /** Only transactions carrying this tag. */
  tag?: string | null;
  includeTransfers?: boolean;
  uncategorisedOnly?: boolean;
  /** The whole "To review" inbox: uncategorised or pending. */
  toReviewOnly?: boolean;
}

export interface TransactionsData {
  transactions: { items: Transaction[]; nextCursor: string | null };
}

export interface QuickPreset {
  id: string;
  label: string;
  emoji: string | null;
  amountMinor: number | null;
  payee: string | null;
  category: Category;
  account: { id: string } | null;
}

export type QuickLogAccount = Pick<Account, "id" | "name" | "type" | "currency" | "last4">;

export interface QuickLogContext {
  defaultAccount: { id: string } | null;
  accounts: QuickLogAccount[];
  suggestedCategories: Category[];
  presets: QuickPreset[];
  recentPayees: { payee: string; category: { id: string } | null }[];
  toReviewCount: number;
  lastAccountByCategory: Record<string, string>;
}

export interface QuickLogData {
  quickLog: {
    transaction: Transaction;
    suggestPreset: boolean;
    presetKey: string | null;
    /** This expense took its category's budget past 80% or 100% this month. */
    budgetAlert: BudgetAlertNotice | null;
  };
}

export interface CategorySpend {
  /** Null: uncategorised. */
  category: Category | null;
  /** Out minus refunds; negative when refunds won. */
  spentMinor: number;
  previousSpentMinor: number;
  transactionCount: number;
}

export interface CashFlowMonth {
  /** YYYY-MM */
  month: string;
  inMinor: number;
  outMinor: number;
  netMinor: number;
}

export interface CashFlowReport {
  currency: string;
  unconverted: string[];
  /** Oldest first. */
  months: CashFlowMonth[];
}

export interface SpendReport {
  month: string;
  currency: string;
  unconverted: string[];
  spentMinor: number;
  previousSpentMinor: number;
  incomeMinor: number;
  categories: CategorySpend[];
}

export type BudgetPace = "ON_TRACK" | "CLOSE" | "OVER";

export interface BudgetLine {
  category: Category;
  limitMinor: number;
  carriedMinor: number;
  availableMinor: number;
  spentMinor: number;
  remainingMinor: number;
  rollover: boolean;
  /** "YYYY-MM" the limit was last set. */
  since: string;
  pace: BudgetPace;
  /** 80% (NEAR) or 100% (REACHED) of the budget spent; null below 80%. */
  alert: BudgetAlert | null;
  averageSpentMinor: number;
}

export interface BudgetReport {
  month: string;
  currency: string;
  unconverted: string[];
  monthProgress: number;
  totals: { availableMinor: number; spentMinor: number; remainingMinor: number };
  lines: BudgetLine[];
  unbudgeted: { category: Category | null; spentMinor: number; averageSpentMinor: number }[];
}

export interface CurrencySetting {
  code: string;
  isMain: boolean;
  /** Main-currency units per 1 unit, set by the user. */
  overrideToMain: number | null;
  marketRateToMain: number | null;
  /** What conversions use: the override, else the market rate. */
  rateToMain: number | null;
  accountCount: number;
}

export interface CurrencySettingsData {
  currencySettings: {
    currencies: CurrencySetting[];
    rates: {
      date: string;
      source: string;
      fetchedAt: string;
      attribution: { label: string; url: string };
    } | null;
  };
}

export type ImportRowStatus = "NEW" | "DUPLICATE" | "MATCHED" | "BEFORE_OPENING";

export type CsvDateFormat =
  | "YYYY-MM-DD"
  | "DD/MM/YYYY"
  | "MM/DD/YYYY"
  | "DD-MM-YYYY"
  | "DD.MM.YYYY";

/** How a bank CSV's columns map onto transactions; the API validates it (csvMappingSchema). */
export interface CsvMapping {
  hasHeader: boolean;
  dateColumn: number;
  dateFormat: CsvDateFormat;
  amount:
    | { mode: "single"; column: number; invert: boolean }
    | { mode: "split"; debitColumn: number; creditColumn: number };
  payeeColumn: number | null;
  noteColumn: number | null;
}

/** What `POST /uploads/transactions-csv` answers: the server has the file now. */
export interface CsvUpload {
  id: string;
  rowCount: number;
  headers: string[];
  sample: string[][];
  mapping: CsvMapping;
}

export interface CsvImportPreview {
  currency: string;
  total: number;
  new: number;
  duplicates: number;
  matched: number;
  beforeOpening: number;
  rows: {
    line: number;
    date: string;
    amountMinor: number;
    payee: string | null;
    note: string | null;
    status: ImportRowStatus;
    category: Category | null;
  }[];
  problems: { line: number; reason: "date" | "amount"; value: string }[];
}

export type BillingInterval = "WEEK" | "MONTH" | "YEAR";
export type SubscriptionStatus = "ACTIVE" | "TRIAL" | "PAUSED" | "ENDING" | "ENDED";
export type ChargeStatus = "PENDING" | "CONFIRMED" | "SKIPPED" | "UPCOMING";

export interface SubscriptionService {
  key: string;
  name: string;
  domain: string;
  logoUrl: string;
}

export interface Subscription {
  id: string;
  name: string;
  /** Money in (a salary): positive amounts, left out of cost totals. */
  isIncome: boolean;
  /** Charges are logged by themselves as PENDING transactions. */
  autoLog: boolean;
  serviceKey: string | null;
  domain: string | null;
  /** Our own /logos/<domain> URL; null without a website. */
  logoUrl: string | null;
  account: Pick<Account, "id" | "name" | "currency">;
  category: Category | null;
  interval: BillingInterval;
  intervalCount: number;
  /** YYYY-MM-DD dates. */
  firstChargeOn: string;
  trialEndsOn: string | null;
  endsOn: string | null;
  /** ISO timestamp. */
  pausedAt: string | null;
  note: string | null;
  status: SubscriptionStatus;
  /** The account's currency; every amount here is in it. */
  currency: string;
  amountMinor: number;
  nextChargeOn: string | null;
  monthlyMinor: number;
  yearlyMinor: number;
  /** Newest first. */
  prices: { amountMinor: number; effectiveFrom: string }[];
}

export interface SubscriptionCharge {
  id: string;
  dueOn: string;
  amountMinor: number;
  currency: string;
  status: ChargeStatus;
  transactionId: string | null;
  /** The logged transaction is still PENDING. */
  transactionPending: boolean;
  afterTrial: boolean;
  subscription: Pick<Subscription, "id" | "name" | "logoUrl" | "isIncome"> & {
    account: Pick<Account, "id" | "name">;
  };
}

export interface SubscriptionSummary {
  currency: string;
  unconverted: string[];
  activeCount: number;
  monthlyMinor: number;
  yearlyMinor: number;
  next30DaysMinor: number;
  pendingCount: number;
}

// ─── To-do lists ─────────────────────────────────────────────────────────────

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export interface TodoList {
  id: string;
  name: string;
  /** Uppercase, 2–6 characters; the key prefix of every task in the list. */
  prefix: string;
  nextNumber: number;
  isInbox: boolean;
  position: number;
  openCount: number;
  doneCount: number;
  /** Its board columns, left to right. */
  columns: TodoColumn[];
}

/** A board column; `name` null shows the status's own name. Its status is its tasks' status. */
export interface TodoColumn {
  id: string;
  listId: string;
  name: string | null;
  status: TaskStatus;
  position: number;
  taskCount: number;
}

/** A linked task, as shown in a dependency list. */
export interface TaskRef {
  id: string;
  key: string;
  title: string;
  status: TaskStatus;
}

export interface Task {
  id: string;
  /** "<list prefix>-<number>", e.g. GRO-12. */
  key: string;
  number: number;
  listId: string;
  list: Pick<TodoList, "id" | "name" | "prefix" | "isInbox">;
  title: string;
  notes: string | null;
  status: TaskStatus;
  /** Its board column; `status` is the column's. */
  columnId: string;
  position: number;
  /** "YYYY-MM-DD", or null when not planned. */
  plannedFor: string | null;
  /** Order within its planned day, for Today. */
  dayPosition: number;
  /** "YYYY-MM-DD" deadline, separate from the planned day. */
  dueOn: string | null;
  completedAt: string | null;
  createdAt: string;
  /** Tasks this one waits for, in any list. */
  blockedBy: TaskRef[];
  /** Tasks waiting for this one. */
  blocks: TaskRef[];
  /** True while anything it waits for isn't done. */
  blocked: boolean;
}

export interface TodoListsData {
  todoLists: TodoList[];
}

export interface TodayTasksData {
  todayTasks: { today: Task[]; earlier: Task[]; dueSoon: Task[] };
}

export interface ListBoardData {
  listBoard: { list: TodoList; tasks: Task[]; doneTotal: number };
}

// ─── Habit calendar, review, achievements, points, routines ──────────────────

export interface HabitDayCell {
  date: string;
  status: HabitDayStatus;
  value: number | null;
}

export interface HabitCalendarData {
  habitCalendar: { habitId: string; days: HabitDayCell[] }[];
}

export interface ReviewTotals {
  done: number;
  due: number;
  rate: number | null;
}

export interface WeeklyReview {
  weekStart: string;
  weekEnd: string;
  complete: boolean;
  totals: ReviewTotals;
  previous: ReviewTotals;
  habits: {
    id: string;
    name: string;
    done: number;
    due: number;
    rate: number | null;
    missed: string[];
    frozen: number;
  }[];
  wins: string[];
  atRisk: { id: string; name: string; currentStreak: number }[];
  bestDay: { date: string; done: number } | null;
}

export type AchievementKey =
  | "FIRST_CHECK_IN"
  | "CHECK_INS_100"
  | "CHECK_INS_500"
  | "STREAK_7"
  | "STREAK_30"
  | "STREAK_100"
  | "PERFECT_WEEK"
  | "CHALLENGE_WON"
  | "LEVEL_5";

export interface Achievement {
  key: AchievementKey;
  progress: number;
  target: number;
  unlocked: boolean;
  achievedOn: string | null;
}

export interface HabitCorrelation {
  habitId: string;
  otherId: string;
  kind: "RATE" | "VALUE";
  withValue: number;
  withoutValue: number;
  daysWith: number;
  daysWithout: number;
}

export interface PointsSpend {
  id: string;
  points: number;
  kind: "reward" | "freeze";
  label: string;
  createdAt: string;
}

export interface PointsWallet {
  earned: number;
  spent: number;
  balance: number;
  freezeCost: number;
  spends: PointsSpend[];
}

export interface Reward {
  id: string;
  name: string;
  emoji: string | null;
  cost: number;
  timesRedeemed: number;
}

export type ChallengeStatus = "UPCOMING" | "ACTIVE" | "WON" | "LOST";

export interface HabitChallenge {
  id: string;
  habitId: string;
  habitName: string;
  startDate: string;
  endDate: string;
  target: number;
  multiplier: number;
  done: number;
  status: ChallengeStatus;
  bonusPoints: number;
}

export interface Routine {
  id: string;
  name: string;
  icon: string | null;
  startTime: string | null;
  position: number;
  /** In order. */
  habitIds: string[];
}

// ─── Progress ────────────────────────────────────────────────────────────────

export interface ProgressWeek {
  weekStart: string;
  done: number;
  due: number;
  rate: number | null;
}

export interface HabitProgressData {
  habitProgress: {
    weeks: ProgressWeek[];
    habits: {
      id: string;
      name: string;
      done: number;
      due: number;
      rate: number | null;
      perWeek: number[];
      perWeekDue: number[];
    }[];
    days: { date: string; done: number; due: number }[];
  };
}

export interface TaskProgressWeek {
  weekStart: string;
  completed: number;
  onTime: number;
  late: number;
  noDueDate: number;
}

export interface TaskProgressData {
  taskProgress: { weeks: TaskProgressWeek[]; overdueNow: number };
}
