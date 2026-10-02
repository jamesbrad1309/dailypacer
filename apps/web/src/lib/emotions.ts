import type { JournalDay } from "#graphql/types";
import { journal as en } from "#i18n/en/journal";
import { journal as vi } from "#i18n/vi/journal";
import { fold } from "#lib/fold";

export type Valence = "pleasant" | "neutral" | "unpleasant";

export interface Emotion {
  /** Stored as-is in JournalEntry.emotion. Displayed via `journal.emotions.<name>`. */
  name: string;
  emoji: string;
  valence: Valence;
}

/**
 * The emotion vocabulary for FEELING entries. The API stores any word, so
 * this list can grow without a migration — entries using a word that's
 * later removed still render, via `emotionFor`'s fallback.
 */
export const EMOTIONS: Emotion[] = [
  { name: "happy", emoji: "😊", valence: "pleasant" },
  { name: "grateful", emoji: "🙏", valence: "pleasant" },
  { name: "calm", emoji: "😌", valence: "pleasant" },
  { name: "excited", emoji: "🤩", valence: "pleasant" },
  { name: "proud", emoji: "💪", valence: "pleasant" },
  { name: "loved", emoji: "🥰", valence: "pleasant" },
  { name: "hopeful", emoji: "🌱", valence: "pleasant" },
  { name: "relieved", emoji: "😮‍💨", valence: "pleasant" },
  { name: "energized", emoji: "⚡", valence: "pleasant" },
  { name: "joyful", emoji: "😄", valence: "pleasant" },
  { name: "content", emoji: "🙂", valence: "pleasant" },
  { name: "peaceful", emoji: "🕊️", valence: "pleasant" },
  { name: "confident", emoji: "😎", valence: "pleasant" },
  { name: "motivated", emoji: "🔥", valence: "pleasant" },
  { name: "inspired", emoji: "✨", valence: "pleasant" },
  { name: "playful", emoji: "😜", valence: "pleasant" },
  { name: "amused", emoji: "😂", valence: "pleasant" },
  { name: "affectionate", emoji: "🤗", valence: "pleasant" },
  { name: "connected", emoji: "🤝", valence: "pleasant" },
  { name: "optimistic", emoji: "🌤️", valence: "pleasant" },
  { name: "focused", emoji: "🎯", valence: "pleasant" },
  { name: "rested", emoji: "🛌", valence: "pleasant" },
  { name: "okay", emoji: "😐", valence: "neutral" },
  { name: "curious", emoji: "🤔", valence: "neutral" },
  { name: "bored", emoji: "🥱", valence: "neutral" },
  { name: "numb", emoji: "😶", valence: "neutral" },
  { name: "surprised", emoji: "😮", valence: "neutral" },
  { name: "nostalgic", emoji: "📼", valence: "neutral" },
  { name: "indifferent", emoji: "😑", valence: "neutral" },
  { name: "conflicted", emoji: "🤷", valence: "neutral" },
  { name: "distracted", emoji: "🫠", valence: "neutral" },
  { name: "anxious", emoji: "😰", valence: "unpleasant" },
  { name: "stressed", emoji: "😣", valence: "unpleasant" },
  { name: "sad", emoji: "😢", valence: "unpleasant" },
  { name: "angry", emoji: "😠", valence: "unpleasant" },
  { name: "frustrated", emoji: "😤", valence: "unpleasant" },
  { name: "tired", emoji: "😴", valence: "unpleasant" },
  { name: "lonely", emoji: "🥺", valence: "unpleasant" },
  { name: "overwhelmed", emoji: "🤯", valence: "unpleasant" },
  { name: "disappointed", emoji: "😞", valence: "unpleasant" },
  { name: "guilty", emoji: "😔", valence: "unpleasant" },
  { name: "scared", emoji: "😨", valence: "unpleasant" },
  { name: "worried", emoji: "😟", valence: "unpleasant" },
  { name: "nervous", emoji: "😬", valence: "unpleasant" },
  { name: "irritated", emoji: "😒", valence: "unpleasant" },
  { name: "jealous", emoji: "🫤", valence: "unpleasant" },
  { name: "ashamed", emoji: "😳", valence: "unpleasant" },
  { name: "embarrassed", emoji: "🙈", valence: "unpleasant" },
  { name: "hurt", emoji: "💔", valence: "unpleasant" },
  { name: "grieving", emoji: "🖤", valence: "unpleasant" },
  { name: "hopeless", emoji: "🕳️", valence: "unpleasant" },
  { name: "insecure", emoji: "🫣", valence: "unpleasant" },
  { name: "restless", emoji: "🌀", valence: "unpleasant" },
  { name: "confused", emoji: "😵‍💫", valence: "unpleasant" },
  { name: "impatient", emoji: "⏳", valence: "unpleasant" },
  { name: "sick", emoji: "🤒", valence: "unpleasant" },
  { name: "homesick", emoji: "🏠", valence: "unpleasant" },
];

const BY_NAME = new Map(EMOTIONS.map((emotion) => [emotion.name, emotion]));

/**
 * Every way of writing each emotion, in every language: its key, its name in
 * each language ("lo âu"), and each language's aliases ("worried", "sợ").
 */
function phrasesFor(name: string): string[] {
  const key = name as keyof typeof en.emotions;
  return [
    name,
    ...[en, vi].flatMap((words) => [
      words.emotions[key],
      ...((words.emotionAliases as Record<string, string[]>)[name] ?? []),
    ]),
  ].filter(Boolean);
}

/**
 * Folded phrase words → the key that's stored, longest phrase first, so
 * "tràn đầy năng lượng" wins over a shorter phrase that starts the same way
 * and "chán nản" (sad) over "chán" (bored).
 */
export const EMOTION_PHRASES: [string[], string][] = EMOTIONS.flatMap(({ name }) =>
  [...new Set(phrasesFor(name).map(fold))].map((p): [string[], string] => [p.split(/\s+/), name]),
).sort((a, b) => b[0].length - a[0].length);

const KEY_BY_PHRASE = new Map(EMOTION_PHRASES.map(([words, key]) => [words.join(" "), key]));

/**
 * The vocabulary key for a stored or typed emotion word ("Worried", "lo lắng"
 * → "worried"), or undefined for a word outside the vocabulary. Entries saved
 * before an alias existed still resolve, since this runs when they're read.
 */
export function resolveEmotion(word: string): string | undefined {
  return BY_NAME.has(word) ? word : KEY_BY_PHRASE.get(fold(word));
}

/** The emotion for a stored word; an unknown word keeps its text with a 💭 and no valence of its own. */
export function emotionFor(name: string): Emotion {
  const key = resolveEmotion(name);
  return (key && BY_NAME.get(key)) || { name, emoji: "💭", valence: "neutral" };
}

/** Share of pleasant / neutral / unpleasant among `names`, for the mood-mix bar. */
export function valenceMix(names: string[]): Record<Valence, number> {
  const mix: Record<Valence, number> = { pleasant: 0, neutral: 0, unpleasant: 0 };
  for (const name of names) mix[emotionFor(name).valence]++;
  return mix;
}

/** The day's most frequent emotion (latest wins a tie), shown as its emoji. */
export function dominantEmotion(day: JournalDay | undefined): string | null {
  if (!day || day.emotions.length === 0) return null;
  const counts = new Map<string, number>();
  let best = day.emotions[0];
  for (const name of day.emotions) {
    const count = (counts.get(name) ?? 0) + 1;
    counts.set(name, count);
    if (count >= (counts.get(best) ?? 0)) best = name;
  }
  return emotionFor(best).emoji;
}
