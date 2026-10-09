import { describe, expect, it } from "vitest";
import {
  assertEveryModelClassified,
  type ModelInfo,
  modelInfo,
  scopeArgs,
  scopeWhere,
  stampOwner,
} from "./ownership";

const info = modelInfo();

describe("the schema", () => {
  it("knows which scalar holds each owned relation's id", () => {
    expect(info.Transaction.account).toEqual({ target: "Account", fromField: "accountId" });
    expect(info.Transaction.category).toEqual({ target: "Category", fromField: "categoryId" });
    expect(info.TaskDependency.dependsOn).toEqual({ target: "Task", fromField: "dependsOnId" });
    expect(info.Category.parent).toEqual({ target: "Category", fromField: "parentId" });
    expect(info.Category.children.fromField).toBeUndefined();
    expect(info.PointsSpend.freeze).toEqual({ target: "StreakFreeze", fromField: "freezeId" });
    expect(info.Task.column).toEqual({ target: "TodoColumn", fromField: "columnId" });
  });

  it("covers every foreign key to an owned model", () => {
    // A relation named unlike its scalar (e.g. `owner` / `ownerAccountId`) would slip past the checks.
    for (const [model, relations] of Object.entries(info)) {
      for (const [field, relation] of Object.entries(relations)) {
        const listSide = Object.values(info[relation.target] ?? {}).some(
          (r) => r.target === model && r.fromField,
        );
        if (relation.fromField === undefined && !listSide && relation.target !== "User") {
          throw new Error(`${model}.${field} has no matching ${field}Id scalar`);
        }
      }
    }
  });

  it("says whose every model is", () => {
    expect(() => assertEveryModelClassified(info)).not.toThrow();
    expect(() => assertEveryModelClassified({ ...info, Mystery: {} } as ModelInfo)).toThrow(
      /Mystery/,
    );
  });
});

describe("scopeWhere", () => {
  it("adds the owner to a top-level model's filter, keeping what was there", () => {
    expect(scopeWhere("Account", { id: "a1" }, "u1")).toEqual({
      id: "a1",
      AND: [{ userId: "u1" }],
    });
    expect(scopeWhere("Account", { AND: { name: "x" } }, "u1")).toEqual({
      AND: [{ name: "x" }, { userId: "u1" }],
    });
  });

  it("scopes child rows through their parent", () => {
    expect(scopeWhere("HabitEntry", { habitId: "h1" }, "u1")).toEqual({
      habitId: "h1",
      AND: [{ habit: { userId: "u1" } }],
    });
    expect(scopeWhere("MonthlyTotal", undefined, "u1")).toEqual({
      AND: [{ account: { userId: "u1" } }],
    });
  });
});

describe("stampOwner", () => {
  it("sets userId on scalar-style data and replaces any owner the caller sent", () => {
    expect(stampOwner("Account", { name: "Wallet", userId: "evil" }, "u1", info)).toEqual({
      name: "Wallet",
      userId: "u1",
    });
  });

  it("connects the user when the data uses relation objects", () => {
    expect(stampOwner("Transaction", { account: { connect: { id: "a1" } } }, "u1", info)).toEqual({
      account: { connect: { id: "a1" } },
      user: { connect: { id: "u1" } },
    });
  });

  it("leaves child rows alone", () => {
    expect(stampOwner("HabitEntry", { habitId: "h1" }, "u1", info)).toEqual({ habitId: "h1" });
  });
});

describe("scopeArgs", () => {
  it("collects every owned row a write points at", () => {
    const { args, references } = scopeArgs(
      "Transaction",
      "create",
      {
        data: {
          accountId: "a1",
          categoryId: "c1",
          splits: { create: [{ categoryId: "c2", amountMinor: 1 }] },
        },
      },
      "u1",
      info,
    );
    expect(references).toEqual(
      expect.arrayContaining([
        { model: "Account", id: "a1" },
        { model: "Category", id: "c1" },
        { model: "Category", id: "c2" },
      ]),
    );
    expect((args.data as Record<string, unknown>).userId).toBe("u1");
  });

  it("stamps nested creates of top-level models", () => {
    const { args } = scopeArgs(
      "TodoList",
      "create",
      { data: { name: "Home", tasks: { create: [{ title: "Fix tap", columnId: "col1" }] } } },
      "u1",
      info,
    );
    const tasks = (args.data as { tasks: { create: Record<string, unknown>[] } }).tasks.create;
    expect(tasks[0].userId).toBe("u1");
  });

  it("checks ids set by an update, and scopes which rows it touches", () => {
    const { args, references } = scopeArgs(
      "Budget",
      "updateMany",
      { where: { month: "2026-10-01" }, data: { categoryId: "c9" } },
      "u1",
      info,
    );
    expect(args.where).toEqual({ month: "2026-10-01", AND: [{ userId: "u1" }] });
    expect(references).toEqual([{ model: "Category", id: "c9" }]);
  });

  it("handles upsert's three parts", () => {
    const { args } = scopeArgs(
      "Notification",
      "upsert",
      { where: { id: "n1" }, create: { key: "k", kind: "x" }, update: { kind: "y" } },
      "u1",
      info,
    );
    expect(args).toMatchObject({
      where: { id: "n1", AND: [{ userId: "u1" }] },
      create: { key: "k", kind: "x", userId: "u1" },
      update: { kind: "y" },
    });
  });

  it("scopes reads and counts", () => {
    expect(scopeArgs("Task", "count", {}, "u1", info).args).toEqual({
      where: { AND: [{ userId: "u1" }] },
    });
  });
});
