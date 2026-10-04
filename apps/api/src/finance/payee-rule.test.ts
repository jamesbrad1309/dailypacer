import { describe, expect, it } from "vitest";
import { matchRule, payeeMatches } from "#finance/payee-rule.util";

describe("payeeMatches", () => {
  it("matches a prefix pattern against the whole payee, ignoring case and punctuation", () => {
    expect(payeeMatches("TESCO*", "Tesco Stores 3245")).toBe(true);
    expect(payeeMatches("TESCO*", "TESCO")).toBe(true);
    expect(payeeMatches("TESCO*", "Big Tesco")).toBe(false);
    expect(payeeMatches("*amazon*", "AMZ Amazon.co.uk")).toBe(true);
    expect(payeeMatches("tesco*store", "TESCO EXPRESS STORE")).toBe(true);
  });

  it("matches plain text anywhere, with accents folded", () => {
    expect(payeeMatches("amazon", "AMZ Amazon.co.uk")).toBe(true);
    expect(payeeMatches("cà phê", "CA PHE DEN 12")).toBe(true);
    expect(payeeMatches("sainsburys", "SAINSBURY'S LONDON")).toBe(true);
  });

  it("never matches an empty pattern or payee", () => {
    expect(payeeMatches("*", "anything")).toBe(false);
    expect(payeeMatches("", "anything")).toBe(false);
    expect(payeeMatches("tesco", null)).toBe(false);
  });

  it("treats regex characters in a pattern as text", () => {
    expect(payeeMatches("a.b*", "axb shop")).toBe(false);
  });
});

describe("matchRule", () => {
  it("takes the first matching rule", () => {
    const rules = [
      { pattern: "TESCO PETROL*", categoryId: "transport" },
      { pattern: "TESCO*", categoryId: "groceries" },
    ];
    expect(matchRule(rules, "Tesco Petrol 12")?.categoryId).toBe("transport");
    expect(matchRule(rules, "Tesco Metro")?.categoryId).toBe("groceries");
    expect(matchRule(rules, "Aldi")).toBeNull();
  });
});
