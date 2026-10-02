import { useEffect, useState } from "react";
import { type Lexicon, loadLexicon } from "#lib/lexicon";

/** The optional NRC lexicon (see lib/lexicon.ts): null until loaded, or if it was never fetched. */
export function useLexicon(): Lexicon | null {
  const [lexicon, setLexicon] = useState<Lexicon | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadLexicon().then((loaded) => {
      if (!cancelled) setLexicon(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return lexicon;
}
