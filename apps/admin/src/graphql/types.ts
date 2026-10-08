/** Shapes of the admin queries (hand-written, like apps/web/src/graphql/types.ts). */

export interface AdminOverview {
  tables: { area: "habits" | "journal" | "finance" | "tasks"; table: string; rows: number }[];
  database: { migrations: number; latestMigration: string | null; latestAppliedAt: string | null };
  server: { nodeVersion: string; uptimeSeconds: number; startedAt: string };
}

export type AccountType =
  | "CURRENT"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "LOAN"
  | "IOU"
  | "CASH"
  | "INVESTMENT";

export interface AdminAccount {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  institution: string | null;
  last4: string | null;
  icon: string | null;
  isDefault: boolean;
  balanceMinor: number;
  openingBalanceDate: string;
  archivedAt: string | null;
}

export interface AdminCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  kind: "expense" | "income";
  isSystem: boolean;
  aliases: string[];
  parentId: string | null;
  archivedAt: string | null;
  sortOrder: number;
}

export interface AdminCurrency {
  code: string;
  isMain: boolean;
  overrideToMain: number | null;
  marketRateToMain: number | null;
  rateToMain: number | null;
  accountCount: number;
}

export interface AdminCurrencySettings {
  currencies: AdminCurrency[];
  rates: {
    date: string;
    source: string;
    fetchedAt: string;
    attribution: { label: string; url: string };
  } | null;
}

export interface AdminHabit {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  tags: string[];
  polarity: "BUILD" | "AVOID";
  paused: boolean;
  archivedAt: string | null;
  currentStreak: number;
  totalCompletions: number;
  createdAt: string;
}

export interface AdminTodoList {
  id: string;
  name: string;
  prefix: string;
  isInbox: boolean;
  openCount: number;
  doneCount: number;
  createdAt: string;
}
