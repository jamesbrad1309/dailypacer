import { NotFoundException } from "@nestjs/common";
import { Prisma, type PrismaClient } from "@prisma/client";
import { currentScope } from "#common/database/request-context";

/**
 * Per-user data, enforced in one place: a Prisma extension that every query
 * goes through. With a signed-in user in the request context it
 *
 * - scopes reads, updates and deletes to that user's rows: another user's id
 *   behaves exactly like a missing one (404, never 403);
 * - stamps new rows with the user as their owner;
 * - refuses writes that would point at another user's row (a transaction in
 *   someone else's category), wherever the id came from.
 *
 * Top-level tables have a `userId` column (OWNED_BY_COLUMN); rows below them
 * belong to their parent's owner (OWNED_VIA). Raw SQL bypasses all of this
 * and adds `currentUserId()` itself. See docs/backend/auth.md.
 */

export const OWNED_BY_COLUMN = new Set([
  "Habit",
  "Routine",
  "Reward",
  "PointsSpend",
  "JournalEntry",
  "Account",
  "Category",
  "Transaction",
  "QuickPreset",
  "Budget",
  "Currency",
  "Subscription",
  "TodoList",
  "Task",
  "SavingsGoal",
  "PayeeRule",
  "Notification",
]);

/** Rows owned through a required relation to a column-owned parent. */
export const OWNED_VIA: Record<string, string> = {
  HabitEntry: "habit",
  StreakFreeze: "habit",
  HabitChallenge: "habit",
  HabitPause: "habit",
  RoutineHabit: "routine",
  TransactionSplit: "transaction",
  SubscriptionPrice: "subscription",
  SubscriptionCharge: "subscription",
  TodoColumn: "list",
  TaskDependency: "task",
  SavingsContribution: "goal",
  MonthlyTotal: "account",
};

/** Not anyone's: people and sessions, and market data every user shares. */
export const SHARED = new Set(["User", "Session", "ExchangeRate", "ServiceLogo"]);

export const isOwned = (model: string) => OWNED_BY_COLUMN.has(model) || model in OWNED_VIA;

/** A relation field: the model it points at, and the scalar holding the id (on this side). */
export interface RelationInfo {
  target: string;
  fromField?: string;
}
export type ModelInfo = Record<string, Record<string, RelationInfo>>;

/**
 * The relations of every model, from Prisma's own description of the schema.
 * The runtime copy leaves out which scalar holds a relation's id, so it
 * follows the schema's naming: relation `account` ↔ scalar `accountId`
 * (ownership.test.ts checks the ones that matter).
 */
export function modelInfo(datamodel = Prisma.dmmf.datamodel): ModelInfo {
  const info: ModelInfo = {};
  for (const model of datamodel.models) {
    const scalars = new Set(model.fields.filter((f) => f.kind !== "object").map((f) => f.name));
    info[model.name] = {};
    for (const field of model.fields) {
      if (field.kind !== "object") continue;
      const fromField =
        !field.isList && scalars.has(`${field.name}Id`) ? `${field.name}Id` : undefined;
      info[model.name][field.name] = { target: field.type, fromField };
    }
  }
  return info;
}

/** Fails at start-up if a model was added without saying whose it is. */
export function assertEveryModelClassified(info: ModelInfo): void {
  const unclassified = Object.keys(info).filter((m) => !isOwned(m) && !SHARED.has(m));
  if (unclassified.length) {
    throw new Error(
      `Models without an owner rule: ${unclassified.join(", ")}. Add them to OWNED_BY_COLUMN, OWNED_VIA or SHARED in ownership.ts.`,
    );
  }
}

type Args = Record<string, unknown>;
type Data = Record<string, unknown>;

const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

/** The filter that keeps a model's rows to one user's. */
export function ownerFilter(model: string, userId: string): Data {
  if (OWNED_BY_COLUMN.has(model)) return { userId };
  return { [OWNED_VIA[model]]: { userId } };
}

/** `where`, narrowed to the user's rows (kept as a unique filter for findUnique and friends). */
export function scopeWhere(model: string, where: unknown, userId: string): Data {
  const base = (where ?? {}) as Data;
  const existing = base.AND === undefined ? [] : Array.isArray(base.AND) ? base.AND : [base.AND];
  return { ...base, AND: [...existing, ownerFilter(model, userId)] };
}

/**
 * New row data with its owner. Prisma's create input sets the rows it points
 * at either as scalar ids (`accountId`) or as relation objects (`account:
 * { connect }`), not both, so the owner goes in the same style. Nested child
 * lists (`splits: { create }`) are allowed in either.
 */
export function stampOwner(model: string, data: Data, userId: string, info: ModelInfo): Data {
  if (!OWNED_BY_COLUMN.has(model)) return data;
  const { userId: _ignoredId, user: _ignoredUser, ...rest } = data;
  const relations = info[model] ?? {};
  const usesRelationObjects = Object.keys(rest).some(
    (key) =>
      relations[key]?.fromField !== undefined &&
      rest[key] !== null &&
      typeof rest[key] === "object",
  );
  return usesRelationObjects ? { ...rest, user: { connect: { id: userId } } } : { ...rest, userId };
}

/** One id a write points at, to check it belongs to the same user. */
export interface Reference {
  model: string;
  id: string;
}

const asList = (value: unknown): Data[] =>
  Array.isArray(value)
    ? (value as Data[])
    : value && typeof value === "object"
      ? [value as Data]
      : [];

/**
 * Stamps nested creates and collects every owned row the data points at:
 * scalar ids (`categoryId`), `connect: { id }`, and the same inside nested
 * `create` / `createMany`. Returns the data to send.
 */
export function prepareWrite(
  model: string,
  data: Data,
  userId: string,
  info: ModelInfo,
  references: Reference[],
  stamp: boolean,
): Data {
  const relations = info[model] ?? {};
  const out: Data = { ...data };
  for (const [field, relation] of Object.entries(relations)) {
    if (!isOwned(relation.target)) continue;
    if (relation.fromField && typeof out[relation.fromField] === "string") {
      references.push({ model: relation.target, id: out[relation.fromField] as string });
    }
    const nested = out[field];
    if (!nested || typeof nested !== "object") continue;
    const ops = { ...(nested as Data) };
    for (const connected of asList(ops.connect)) {
      if (typeof connected.id === "string")
        references.push({ model: relation.target, id: connected.id });
    }
    if (ops.create) {
      const created = asList(ops.create).map((child) =>
        prepareWrite(relation.target, child, userId, info, references, true),
      );
      ops.create = Array.isArray(ops.create) ? created : created[0];
    }
    const many = ops.createMany as Data | undefined;
    if (many && Array.isArray(many.data)) {
      ops.createMany = {
        ...many,
        data: many.data.map((child: Data) =>
          prepareWrite(relation.target, child, userId, info, references, true),
        ),
      };
    }
    out[field] = ops;
  }
  return stamp ? stampOwner(model, out, userId, info) : out;
}

/** Rewrites one operation's arguments for a user; collects the ids to check. */
export function scopeArgs(
  model: string,
  operation: string,
  args: Args,
  userId: string,
  info: ModelInfo,
): { args: Args; references: Reference[] } {
  const references: Reference[] = [];
  const next: Args = { ...args };
  if (WHERE_OPERATIONS.has(operation)) next.where = scopeWhere(model, args.where, userId);

  if (operation === "create") {
    next.data = prepareWrite(model, args.data as Data, userId, info, references, true);
  } else if (operation === "createMany" || operation === "createManyAndReturn") {
    next.data = asList(args.data).map((row) =>
      prepareWrite(model, row, userId, info, references, true),
    );
  } else if (
    operation === "update" ||
    operation === "updateMany" ||
    operation === "updateManyAndReturn"
  ) {
    next.data = prepareWrite(model, args.data as Data, userId, info, references, false);
  } else if (operation === "upsert") {
    next.create = prepareWrite(model, args.create as Data, userId, info, references, true);
    next.update = prepareWrite(model, args.update as Data, userId, info, references, false);
  }
  return { args: next, references };
}

const delegate = (client: PrismaClient, model: string) =>
  (client as unknown as Record<string, { findUnique: (args: unknown) => Promise<Data | null> }>)[
    model.charAt(0).toLowerCase() + model.slice(1)
  ];

/**
 * Whose a row is, read outside any transaction. A row that isn't visible
 * yet (created earlier in the same database transaction) is allowed: it can
 * only have been created by this request, and the foreign key still checks
 * that it exists.
 */
async function ownerOf(base: PrismaClient, reference: Reference): Promise<string | null> {
  const via = OWNED_VIA[reference.model];
  const select = via ? { [via]: { select: { userId: true } } } : { userId: true };
  const row = await delegate(base, reference.model).findUnique({
    where: { id: reference.id },
    select,
  });
  if (!row) return null;
  return (via ? (row[via] as Data).userId : row.userId) as string;
}

export function withOwnership<T extends PrismaClient>(base: T): T {
  const info = modelInfo();
  assertEveryModelClassified(info);
  return base.$extends({
    name: "ownership",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!isOwned(model)) return query(args);
          const scope = currentScope();
          if (scope.kind === "system") return query(args);
          if (scope.kind === "none") {
            throw new Error(
              `${model}.${operation} without a user: run it in a request, asUser() or asSystem()`,
            );
          }
          const scoped = scopeArgs(model, operation, args as Args, scope.userId, info);
          for (const reference of scoped.references) {
            const owner = await ownerOf(base, reference);
            if (owner !== null && owner !== scope.userId) {
              throw new NotFoundException(`${reference.model} ${reference.id} not found`);
            }
          }
          return query(scoped.args as typeof args);
        },
      },
    },
  }) as unknown as T;
}
