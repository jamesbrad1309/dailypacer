import type { JournalDayFeeling, JournalEntry, JournalFeeling } from "#graphql/types";
import { emotionFor, resolveEmotion } from "#lib/emotions";
import type { Lexicon } from "#lib/lexicon";
import { moodScore } from "#lib/mood";

/** Feelings grouped by day, then scored (lib/mood.ts): day → −1…+1. Days without a known feeling are left out. */
export function moodByDay(
  feelings: readonly JournalFeeling[],
  lexicon: Lexicon | null = null,
): Map<string, number> {
  const byDay = new Map<string, JournalDayFeeling[]>();
  for (const { date, emotion, intensity } of feelings) {
    byDay.set(date, [...(byDay.get(date) ?? []), { emotion, intensity }]);
  }
  const scores = new Map<string, number>();
  for (const [date, list] of byDay) {
    const score = moodScore(list, lexicon);
    if (score !== null) scores.set(date, score);
  }
  return scores;
}

function addDay(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The mood check-in streak: days in a row, back from today, with at least
 * one feeling logged. Today not logged yet doesn't break it (it isn't over);
 * the streak then counts back from yesterday. Also the best run.
 */
export function moodStreak(
  daysWithFeelings: ReadonlySet<string>,
  today: string,
): { current: number; best: number; loggedToday: boolean } {
  const loggedToday = daysWithFeelings.has(today);
  let current = 0;
  for (
    let day = loggedToday ? today : addDay(today, -1);
    daysWithFeelings.has(day);
    day = addDay(day, -1)
  ) {
    current++;
  }
  const sorted = [...daysWithFeelings].sort();
  let best = 0;
  let run = 0;
  sorted.forEach((day, i) => {
    run = i > 0 && addDay(sorted[i - 1], 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return { current, best, loggedToday };
}

export interface TriggerPattern {
  /** The event tag ("work"), or null for events without one (grouped by tone instead). */
  tag: string;
  /** Events with the tag that something was linked to. */
  events: number;
  /** Feelings linked to those events. */
  feelings: number;
  /** The most common emotion and how many of the feelings it was. */
  top: { emotion: string; count: number };
  /** Share of the feelings that were unpleasant / pleasant, 0–1. */
  unpleasant: number;
  pleasant: number;
}

/** Each tag needs this many linked feelings before it's a pattern. */
export const MIN_PATTERN_FEELINGS = 3;

/**
 * Which events drive which feelings: feelings linked to an event (its
 * "because of…"), grouped by the event's #tags. For each tag: how many
 * events, how many feelings, the most common emotion, and the share that
 * were unpleasant or pleasant ("#work → stressed, 70% unpleasant"). Tags
 * with fewer than MIN_PATTERN_FEELINGS feelings are left out; most
 * feelings first.
 */
export function triggerPatterns(entries: readonly JournalEntry[]): TriggerPattern[] {
  const byTag = new Map<string, { events: Set<string>; emotions: string[] }>();
  for (const entry of entries) {
    if (entry.kind !== "FEELING" || !entry.emotion || !entry.trigger) continue;
    for (const tag of entry.trigger.tags) {
      const group = byTag.get(tag) ?? { events: new Set(), emotions: [] };
      group.events.add(entry.trigger.id);
      group.emotions.push(resolveEmotion(entry.emotion) ?? entry.emotion);
      byTag.set(tag, group);
    }
  }
  const patterns: TriggerPattern[] = [];
  for (const [tag, { events, emotions }] of byTag) {
    if (emotions.length < MIN_PATTERN_FEELINGS) continue;
    const counts = new Map<string, number>();
    for (const e of emotions) counts.set(e, (counts.get(e) ?? 0) + 1);
    const [emotion, count] = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
    const share = (valence: string) =>
      emotions.filter((e) => emotionFor(e).valence === valence).length / emotions.length;
    patterns.push({
      tag,
      events: events.size,
      feelings: emotions.length,
      top: { emotion, count },
      unpleasant: share("unpleasant"),
      pleasant: share("pleasant"),
    });
  }
  return patterns.sort((a, b) => b.feelings - a.feelings || a.tag.localeCompare(b.tag));
}
