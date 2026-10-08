import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Who the current work is for, carried through every async call without
 * passing it around: a request (set by AuthGuard), a CLI run for one user
 * (`asUser`), or deliberate work across everyone (`asSystem`). The
 * ownership extension (ownership.ts) reads it on every query.
 */
interface Context {
  userId?: string;
  /** Background work that must see every user's rows (admin row counts). */
  system?: boolean;
}

const storage = new AsyncLocalStorage<Context>();

/** Starts an empty context for one HTTP request (main.ts); AuthGuard fills in the user. */
export function runRequest(next: () => void): void {
  storage.run({}, next);
}

export function setCurrentUser(userId: string): void {
  const context = storage.getStore();
  if (!context) throw new Error("setCurrentUser outside a request context");
  context.userId = userId;
}

export function asUser<T>(userId: string, work: () => Promise<T>): Promise<T> {
  return storage.run({ userId }, work);
}

/** Runs `work` across every user's data. Only for aggregates no user sees rows of. */
export function asSystem<T>(work: () => Promise<T>): Promise<T> {
  return storage.run({ system: true }, work);
}

export type Scope = { kind: "user"; userId: string } | { kind: "system" } | { kind: "none" };

export function currentScope(): Scope {
  const context = storage.getStore();
  if (context?.userId) return { kind: "user", userId: context.userId };
  if (context?.system) return { kind: "system" };
  return { kind: "none" };
}

/** The signed-in user's id, for raw SQL that the ownership extension can't see. */
export function currentUserId(): string {
  const scope = currentScope();
  if (scope.kind !== "user") throw new Error("No signed-in user for this query");
  return scope.userId;
}
