import { describe, expect, it } from "vitest";
import type { JournalDay } from "#graphql/types";
import { EMOTION_PHRASES } from "#lib/emotions";
import { averageMood, formatMood, moodBand, moodScore } from "#lib/mood";

const day = (feelings: JournalDay["feelings"]): JournalDay => ({
  date: "2026-09-01",
  actionCount: 0,
  feelingCount: feelings.length,
  eventCount: 0,
  emotions: feelings.map((f) => f.emotion),
  feelings,
});

describe("moodScore", () => {
  it("is null when nothing was felt", () => {
    expect(moodScore([])).toBeNull();
  });

  it("is +1 / −1 when every feeling is pleasant / unpleasant", () => {
    expect(moodScore([{ emotion: "happy", intensity: 2 }])).toBe(1);
    expect(moodScore([{ emotion: "anxious", intensity: 5 }])).toBe(-1);
  });

  it("weights feelings by intensity", () => {
    // (+1·1 − 1·5) / 6
    expect(
      moodScore([
        { emotion: "calm", intensity: 1 },
        { emotion: "stressed", intensity: 5 },
      ]),
    ).toBeCloseTo(-4 / 6);
  });

  it("counts a missing intensity as 3, and neutral feelings pull towards 0", () => {
    expect(
      moodScore([
        { emotion: "happy", intensity: null },
        { emotion: "okay", intensity: 3 },
      ]),
    ).toBeCloseTo(0.5);
  });

  it("leaves words outside the vocabulary out, rather than counting them as neutral", () => {
    expect(moodScore([{ emotion: "flibbertigibbet", intensity: 4 }])).toBeNull();
    expect(
      moodScore([
        { emotion: "flibbertigibbet", intensity: 5 },
        { emotion: "sad", intensity: 2 },
      ]),
    ).toBe(-1);
  });

  it("scores stored aliases in either language by their emotion", () => {
    // Saved as typed before these aliases existed.
    expect(moodScore([{ emotion: "exhausted", intensity: 3 }])).toBe(-1);
    expect(moodScore([{ emotion: "kiệt sức", intensity: 3 }])).toBe(-1);
    expect(moodScore([{ emotion: "Thankful", intensity: 3 }])).toBe(1);
  });
});

describe("moodScore with the optional lexicon", () => {
  const lexicon = new Map<string, 1 | -1>([
    ["wistful", -1],
    ["phan chan", 1],
  ]);

  it("scores a word outside the vocabulary by the lexicon, accents folded", () => {
    expect(moodScore([{ emotion: "wistful", intensity: 4 }], lexicon)).toBe(-1);
    expect(moodScore([{ emotion: "phấn chấn", intensity: 4 }], lexicon)).toBe(1);
  });

  it("prefers the app's own vocabulary over the lexicon", () => {
    expect(moodScore([{ emotion: "happy", intensity: 3 }], new Map([["happy", -1]]))).toBe(1);
  });

  it("still leaves out words neither knows", () => {
    expect(moodScore([{ emotion: "flibbertigibbet", intensity: 3 }], lexicon)).toBeNull();
  });
});

describe("averageMood", () => {
  it("averages days that have a score and skips the rest", () => {
    expect(
      averageMood([
        day([{ emotion: "happy", intensity: 3 }]),
        day([
          { emotion: "sad", intensity: 3 },
          { emotion: "happy", intensity: 1 },
        ]),
        day([]),
      ]),
    ).toBeCloseTo((1 + -0.5) / 2);
  });

  it("is null when no day has feelings", () => {
    expect(averageMood([day([])])).toBeNull();
  });
});

describe("moodBand / formatMood", () => {
  it("bands around a ±0.2 dead zone", () => {
    expect(moodBand(0.5)).toBe("good");
    expect(moodBand(0.1)).toBe("mixed");
    expect(moodBand(-0.21)).toBe("low");
  });

  it("formats with a sign and one decimal", () => {
    expect(formatMood(0.5)).toBe("+0.5");
    expect(formatMood(-0.62)).toBe("−0.6");
    expect(formatMood(0.04)).toBe("0");
  });
});

describe("emotion vocabulary", () => {
  it("never gives one phrase (accents folded) to two emotions", () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const [words, key] of EMOTION_PHRASES) {
      const phrase = words.join(" ");
      const seen = owner.get(phrase);
      if (seen && seen !== key) clashes.push(`"${phrase}": ${seen} / ${key}`);
      owner.set(phrase, key);
    }
    expect(clashes).toEqual([]);
  });
});
