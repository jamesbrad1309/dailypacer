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
