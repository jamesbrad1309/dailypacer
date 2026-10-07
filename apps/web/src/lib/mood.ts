import type { JournalDay, JournalDayFeeling } from "#graphql/types";
import { emotionFor, resolveEmotion, type Valence } from "#lib/emotions";
import { type Lexicon, lexiconValence } from "#lib/lexicon";

/** Intensity assumed when a feeling was logged without one (the middle of 1–5). */
const DEFAULT_INTENSITY = 3;

const SIGN: Record<Valence, number> = { pleasant: 1, neutral: 0, unpleasant: -1 };

/**
 * A mood score from −1 (all unpleasant) to +1 (all pleasant): each feeling
 * counts +1 / 0 / −1 by its emotion's valence, weighted by its intensity, so
 * "anxious 5/5" outweighs "calm 1/5". Neutral feelings pull towards 0.
 * Words outside the vocabulary (lib/emotions.ts, with its aliases) are looked
 * up in the optional NRC `lexicon`; a word neither knows is left out rather
 * than counted as neutral, so "wistful 5/5" can't drag a day to 0.
 * Null when no known feeling was logged — "unknown", not "neutral".
 *
 * Emotions are stored by English key whatever language they were written in,
 * so this works the same for an English or a Vietnamese journal.
 */
export function moodScore(
  feelings: readonly JournalDayFeeling[],
  lexicon: Lexicon | null = null,
): number | null {
  let weighted = 0;
  let total = 0;
  for (const { emotion, intensity } of feelings) {
    const sign = resolveEmotion(emotion)
      ? SIGN[emotionFor(emotion).valence]
      : lexiconValence(lexicon, emotion);
    if (sign === undefined) continue;
    const weight = intensity ?? DEFAULT_INTENSITY;
    weighted += sign * weight;
    total += weight;
  }
  return total === 0 ? null : weighted / total;
}

/** The average of the days' scores (each day counts once), or null if none has one. */
export function averageMood(
  days: readonly JournalDay[],
  lexicon: Lexicon | null = null,
): number | null {
  const scores = days.map((day) => moodScore(day.feelings, lexicon)).filter((s) => s !== null);
  return scores.length === 0 ? null : scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

export type MoodBand = "good" | "mixed" | "low";

/** Within ±0.2 of zero reads as mixed rather than good or low. */
export function moodBand(score: number): MoodBand {
  if (score > 0.2) return "good";
  if (score < -0.2) return "low";
  return "mixed";
}

/** −0.62 → "−0.6", 0.5 → "+0.5", for labels. */
export function formatMood(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  if (rounded === 0) return "0";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(1)}`;
}
