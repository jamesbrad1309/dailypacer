import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { dueState, fieldErrors, PREFIX_PATTERN, positionBetween, todoListSchema } from "#lib/todos";

describe("positionBetween", () => {
  it("goes between neighbours, or past either end", () => {
    expect(positionBetween(null, null)).toBe(0);
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(null, 3)).toBe(2);
    expect(positionBetween(3, null)).toBe(4);
  });
});

describe("PREFIX_PATTERN", () => {
  it("accepts 2–6 uppercase characters starting with a letter", () => {
    expect(["GRO", "Q4", "HOME12"].every((p) => PREFIX_PATTERN.test(p))).toBe(true);
    expect(["G", "4Q", "gro", "TOOLONG", "GR-O"].some((p) => PREFIX_PATTERN.test(p))).toBe(false);
  });
});

describe("todoListSchema", () => {
  // Echo the key and params, so the test reads which message was chosen.
  const t = ((key: string, params?: object) =>
    params ? `${key} ${JSON.stringify(params)}` : key) as unknown as TFunction;
  const lists = [
    { id: "inbox", name: "Inbox", prefix: "TASK", isInbox: true },
    { id: "g", name: "Grocery list", prefix: "GRO", isInbox: false },
  ];

  it("accepts a new name and free prefix, uppercasing it", () => {
    expect(todoListSchema(t, lists).parse({ name: " Home ", prefix: "home" })).toEqual({
      name: "Home",
      prefix: "HOME",
    });
  });

  it("names the list that already uses a prefix", () => {
    const result = todoListSchema(t, lists).safeParse({ name: "Food", prefix: "gro" });
    expect(fieldErrors(result.error).prefix).toBe(
      'todos.lists.prefixTaken {"prefix":"GRO","list":"Grocery list"}',
    );
  });

  it("lets a list keep its own prefix when edited", () => {
    expect(todoListSchema(t, lists, "g").safeParse({ name: "Food", prefix: "GRO" }).success).toBe(
      true,
    );
  });

  it("rejects an empty name and a malformed prefix", () => {
    const result = todoListSchema(t, lists).safeParse({ name: "  ", prefix: "1X" });
    expect(fieldErrors(result.error)).toEqual({
      name: "todos.lists.nameRequired",
      prefix: "todos.lists.prefixInvalid",
    });
  });
});

describe("dueState", () => {
  it("reads a deadline against today", () => {
    expect(dueState("2026-10-01", "2026-10-04")).toBe("overdue");
    expect(dueState("2026-10-04", "2026-10-04")).toBe("today");
    expect(dueState("2026-10-07", "2026-10-04")).toBe("soon");
    expect(dueState("2026-10-08", "2026-10-04")).toBe("later");
  });

  it("counts across a month end", () => {
    expect(dueState("2026-11-02", "2026-10-31")).toBe("soon");
  });
});
