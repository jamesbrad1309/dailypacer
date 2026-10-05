/**
 * JSON shapes returned by apps/api's REST endpoints. They're declared here
 * rather than imported from the API package because this is a network
 * contract: the BFF must not depend on the API's Prisma-generated types or
 * build output. Dates arrive as ISO strings; entry dates as "YYYY-MM-DD".
 */

export interface ApiHabit {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  icon: string | null;
  color: string | null;
  unit: string | null;
  targetValue: number | null;
  startTime: string | null;
  schedule: unknown;
  metadata: Record<string, unknown> & { fields?: { label: string; value: string }[] };
  /** "build" | "avoid" */
  polarity: string;
  endDate: string | null;
  archivedAt: string | null;
  pausedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /habits/:id/records`: a page of check-ins and misses. */
export interface ApiHabitRecordsPage {
  items: {
    date: string;
    status: "DONE" | "PARTIAL" | "NOT_DONE" | "MISSED" | "MISSED_WEEK";
    entry: ApiHabitEntry | null;
    week: { start: string; end: string; done: number; target: number } | null;
  }[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; done: number; notDone: number; missed: number };
  trackedSince: string;
  missesByWeek: boolean;
}

export interface ApiHabitEntry {
  id: string;
  habitId: string;
  date: string;
  value: number | null;
  completed: boolean;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ApiHabitStats {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  points: number;
  level: number;
  levelTitle: string;
  heatmap: { date: string; completed: boolean; value: number | null }[];
}

export interface ApiDashboardStats {
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

export type ApiJournalEntryKind = "ACTION" | "FEELING" | "EVENT";

export interface ApiJournalEntry {
  id: string;
  date: string;
  kind: ApiJournalEntryKind;
  time: string | null;
  text: string;
  tags: string[];
  durationMinutes: number | null;
  emotion: string | null;
  intensity: number | null;
  tone: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
  triggerId: string | null;
  /** Just enough of the triggering EVENT to render "because of …". */
  trigger: { id: string; kind: ApiJournalEntryKind; text: string; time: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiJournalDaySummary {
  date: string;
  actionCount: number;
  feelingCount: number;
  eventCount: number;
  emotions: string[];
  feelings: { emotion: string; intensity: number | null }[];
}

export type ApiAccountType =
  | "CURRENT"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "LOAN"
  | "IOU"
  | "CASH"
  | "INVESTMENT";

/** Amounts in minor units; `@db.Date` columns as "YYYY-MM-DD". */
export interface ApiAccount {
  id: string;
  name: string;
  type: ApiAccountType;
  currency: string;
  institution: string | null;
  last4: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isDefault: boolean;
  openingBalanceMinor: number;
  openingBalanceDate: string;
  lastReconciledAt: string | null;
  creditLimitMinor: number | null;
  statementDay: number | null;
  paymentDueDay: number | null;
  minPaymentMinor: number | null;
  aprBps: number | null;
  monthlyPaymentMinor: number | null;
  loanStartDate: string | null;
  termMonths: number | null;
  dueDate: string | null;
  archivedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** `GET /accounts/balances`: the balance plus derived card/loan values, null where n/a. */
export interface ApiAccountMetrics {
  accountId: string;
  balanceMinor: number;
  balanceMainMinor: number | null;
  availableCreditMinor: number | null;
  utilization: number | null;
  nextDueDate: string | null;
  currentStatementSpendMinor: number | null;
  estimatedPayoffMonth: string | null;
  paymentCoversInterest: boolean | null;
}

export interface ApiNetWorth {
  netWorthMinor: number;
  assetsMinor: number;
  liabilitiesMinor: number;
}

export interface ApiCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  kind: string;
  parentId: string | null;
  archivedAt: string | null;
  isSystem: boolean;
  metadata: { key?: string; aliases?: string[]; dismissedPresetSuggestions?: string[] };
  sortOrder: number;
  createdAt: string;
}

/** `date` as "YYYY-MM-DD". */
export interface ApiTransaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  date: string;
  amountMinor: number;
  payee: string | null;
  note: string | null;
  tags: string[];
  transferId: string | null;
  importHash: string | null;
  clientId: string | null;
  source: string;
  status: "CLEARED" | "PENDING";
  metadata: Record<string, unknown>;
  /** Empty unless the transaction is split across categories. */
  splits: ApiTransactionSplit[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiTransactionSplit {
  id: string;
  categoryId: string;
  amountMinor: number;
  note: string | null;
}

export interface ApiPayeeRule {
  id: string;
  pattern: string;
  categoryId: string;
  sortOrder: number;
  createdAt: string;
}

export interface ApiSavingsGoal {
  id: string;
  name: string;
  emoji: string | null;
  targetMinor: number;
  currency: string;
  deadline: string | null;
  accountId: string | null;
  accountName: string | null;
  startDate: string;
  archivedAt: string | null;
  savedMinor: number;
  remainingMinor: number;
  progress: number;
  achieved: boolean;
  overdue: boolean;
  requiredPerMonthMinor: number | null;
  onTrack: boolean | null;
  expectedMinor: number | null;
}

export interface ApiSubscription {
  id: string;
  name: string;
  isIncome: boolean;
  autoLog: boolean;
  serviceKey: string | null;
  domain: string | null;
  accountId: string;
  categoryId: string | null;
  interval: "WEEK" | "MONTH" | "YEAR";
  intervalCount: number;
  firstChargeOn: string;
  trialEndsOn: string | null;
  endsOn: string | null;
  pausedAt: string | null;
  note: string | null;
  createdAt: string;
  status: "active" | "trial" | "paused" | "ending" | "ended";
  currency: string;
  amountMinor: number;
  nextChargeOn: string | null;
  monthlyMinor: number;
  yearlyMinor: number;
  prices: { amountMinor: number; effectiveFrom: string }[];
}

export interface ApiSubscriptionCharge {
  subscriptionId: string;
  dueOn: string;
  amountMinor: number;
  currency: string;
  status: "pending" | "confirmed" | "skipped" | "upcoming";
  transactionId: string | null;
  transactionPending: boolean;
  afterTrial: boolean;
}

export interface ApiTransactionPage {
  items: ApiTransaction[];
  nextCursor: string | null;
}

export interface ApiQuickPreset {
  id: string;
  label: string;
  emoji: string | null;
  amountMinor: number | null;
  categoryId: string;
  accountId: string | null;
  payee: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface ApiQuickLogContext {
  defaultAccountId: string | null;
  suggestedCategories: ApiCategory[];
  presets: ApiQuickPreset[];
  recentPayees: { payee: string; categoryId: string | null }[];
  toReviewCount: number;
  lastAccountByCategory: Record<string, string>;
}

export interface ApiQuickLogResult {
  transaction: ApiTransaction;
  suggestPreset: boolean;
  presetKey: string | null;
  budgetAlert: {
    categoryId: string;
    level: "near" | "reached";
    spentMinor: number;
    availableMinor: number;
    currency: string;
  } | null;
}
