import { fold } from "#lib/fold";

/**
 * Optional: positive/negative words from the NRC Emotion Lexicon, English and
 * Vietnamese, folded. It isn't in the repo — the lexicon may not be
 * redistributed — so it exists only after `pnpm lexicon:fetch --accept-terms`
 * (scripts/fetch-emotion-lexicon.mjs) and the app works the same without it.
 */
export type Lexicon = ReadonlyMap<string, 1 | -1>;

interface LexiconFile {
  words: Record<string, 1 | -1>;
}

// A glob, not an import: it matches nothing when the file is absent (so the
// build still works), and the file becomes its own lazily loaded chunk.
const files = import.meta.glob<LexiconFile>("../../lexicon/nrc-valence.json", {
  import: "default",
});

let loading: Promise<Lexicon | null> | undefined;

/** The lexicon, loaded once; null when it hasn't been fetched. */
export function loadLexicon(): Promise<Lexicon | null> {
  const load = Object.values(files)[0];
  if (!load) return Promise.resolve(null);
  loading ??= load()
    .then((file) => new Map(Object.entries(file.words)) as Lexicon)
    .catch(() => null);
  return loading;
}

/** +1 / −1 for a word the lexicon knows, else undefined. */
export function lexiconValence(lexicon: Lexicon | null, word: string): 1 | -1 | undefined {
  return lexicon?.get(fold(word));
}
