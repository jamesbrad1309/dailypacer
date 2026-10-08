import { describe, expect, it } from "vitest";
import { customFieldsSchema } from "#habits/dto/create-habit.dto";

const parse = (fields: unknown[]) => customFieldsSchema.safeParse(fields);

describe("customFieldsSchema", () => {
  it("reads a field saved before types existed as text", () => {
    const result = parse([{ label: "Coach", value: "Sam" }]);
    expect(result.success && result.data).toEqual([{ label: "Coach", type: "text", value: "Sam" }]);
  });

  it.each([
    ["number", "12.5"],
    ["number", "-3"],
    ["boolean", "true"],
    ["boolean", "false"],
    ["date", "2026-02-28"],
    ["text", "anything"],
  ])("accepts a %s field set to %s", (type, value) => {
    expect(parse([{ label: "F", type, value }]).success).toBe(true);
  });

  it.each([
    ["number", "twelve"],
    ["boolean", "yes"],
    ["date", "2026-02-30"],
    ["date", "28/02/2026"],
  ])("refuses a %s field set to %s", (type, value) => {
    expect(parse([{ label: "F", type, value }]).success).toBe(false);
  });

  it("lets any type be left empty", () => {
    for (const type of ["number", "boolean", "date", "text"]) {
      expect(parse([{ label: "F", type, value: "" }]).success).toBe(true);
    }
    expect(parse([{ label: "F", type: "select", value: "", options: ["a"] }]).success).toBe(true);
  });

  it("keeps a select's value to one of its options, de-duplicated", () => {
    const ok = parse([
      { label: "Mood", type: "select", value: "ok", options: ["great", "ok", "ok"] },
    ]);
    expect(ok.success && ok.data[0]).toEqual({
      label: "Mood",
      type: "select",
      value: "ok",
      options: ["great", "ok"],
    });
    expect(parse([{ label: "Mood", type: "select", value: "meh", options: ["ok"] }]).success).toBe(
      false,
    );
    expect(parse([{ label: "Mood", type: "select", value: "" }]).success).toBe(false);
  });

  it("drops options from fields that aren't a select", () => {
    const result = parse([{ label: "F", type: "text", value: "x", options: ["a"] }]);
    expect(result.success && result.data[0]).toEqual({ label: "F", type: "text", value: "x" });
  });
});
