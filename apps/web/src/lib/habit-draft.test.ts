import { describe, expect, it } from "vitest";
import {
  changeFieldType,
  cleanCustomFields,
  type DraftField,
  draftField,
  fieldIssue,
  parseOptions,
} from "#lib/habit-draft";

const row = (patch: Partial<DraftField>): DraftField => ({ ...draftField(), label: "F", ...patch });

describe("parseOptions", () => {
  it("splits on commas, trims, and drops blanks and repeats", () => {
    expect(parseOptions(" great, ok,,ok , bad ")).toEqual(["great", "ok", "bad"]);
    expect(parseOptions("")).toEqual([]);
  });
});

describe("fieldIssue", () => {
  it("needs a select to have choices", () => {
    expect(fieldIssue(row({ type: "SELECT", options: " , " }))).toBe("needsOptions");
    expect(fieldIssue(row({ type: "SELECT", options: "a, b", value: "b" }))).toBeNull();
    expect(fieldIssue(row({ type: "SELECT", options: "a", value: "z" }))).toBe("invalidValue");
  });

  it("checks a value against its type, and lets any be empty", () => {
    expect(fieldIssue(row({ type: "NUMBER", value: "12.5" }))).toBeNull();
    expect(fieldIssue(row({ type: "NUMBER", value: "lots" }))).toBe("invalidValue");
    expect(fieldIssue(row({ type: "DATE", value: "" }))).toBeNull();
    expect(fieldIssue(row({ type: "BOOLEAN", value: "maybe" }))).toBe("invalidValue");
  });

  it("never blocks on a row without a label, since it's dropped", () => {
    expect(fieldIssue(row({ label: " ", type: "SELECT", options: "" }))).toBeNull();
  });
});

describe("changeFieldType", () => {
  it("keeps a value that still fits and clears one that doesn't", () => {
    expect(changeFieldType(row({ type: "TEXT", value: "42" }), "NUMBER").value).toBe("42");
    expect(changeFieldType(row({ type: "TEXT", value: "Sam" }), "NUMBER").value).toBe("");
    expect(changeFieldType(row({ type: "NUMBER", value: "42" }), "TEXT").value).toBe("42");
  });
});

describe("cleanCustomFields", () => {
  it("trims, drops unlabelled rows, and sends options only for a select", () => {
    expect(
      cleanCustomFields([
        row({ label: " Coach ", value: " Sam ", options: "ignored" }),
        row({ label: "", value: "dropped" }),
        row({ label: "Mood", type: "SELECT", value: "ok", options: "great, ok" }),
      ]),
    ).toEqual([
      { label: "Coach", type: "TEXT", value: "Sam" },
      { label: "Mood", type: "SELECT", value: "ok", options: ["great", "ok"] },
    ]);
  });

  it("round-trips a saved field through the draft", () => {
    const saved = { label: "Mood", type: "SELECT" as const, value: "ok", options: ["great", "ok"] };
    expect(cleanCustomFields([draftField(saved)])).toEqual([saved]);
  });
});
