import { currentUserId } from "#common/database/request-context";

/**
 * Unique keys that are now per user: a currency code, a quick-log client id.
 * The ownership extension scopes these queries too; the key just names the
 * row the way Prisma's unique index does.
 */
export const currencyKey = (code: string) => ({ userId_code: { userId: currentUserId(), code } });

export const clientIdKey = (clientId: string) => ({
  userId_clientId: { userId: currentUserId(), clientId },
});
