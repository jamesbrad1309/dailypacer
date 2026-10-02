/** A list prefix: a letter, then 1–5 letters or digits, uppercase ("GRO", "HOME", "Q4"). */
export const PREFIX_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/;

export function normalizePrefix(input: string): string {
  return input.trim().toUpperCase();
}

/** Accents and đ folded away, so a Vietnamese name still makes an ASCII prefix. */
function asciiLetters(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * A free prefix for a new list: its name's first three letters ("Grocery
 * list" → GRO, "Đi chợ" → DIC), then GRO2, GRO3… if taken. Falls back to
 * LIST when the name has no usable letters.
 */
export function suggestPrefix(name: string, taken: ReadonlySet<string>): string {
  const letters = asciiLetters(name).replace(/^[0-9]+/, "");
  const base = letters.length >= 2 ? letters.slice(0, 3) : "LIST";
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base.slice(0, 6 - String(n).length)}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("No free prefix");
}

export function formatKey(prefix: string, number: number): string {
  return `${prefix}-${number}`;
}

/** "gro-12" / "GRO-12" → { prefix: "GRO", number: 12 }; null if it isn't a key. */
export function parseKey(key: string): { prefix: string; number: number } | null {
  const match = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d{1,9})$/.exec(key.trim());
  if (!match) return null;
  return { prefix: match[1].toUpperCase(), number: Number(match[2]) };
}

/**
 * A board position between two neighbours (either may be missing at the
 * ends of a column), so a drag rewrites only the moved task's row.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return (after as number) - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}

/** At most this many tasks one task can wait for. */
export const MAX_DEPENDENCIES = 20;

/**
 * Whether "task waits for dependsOn" would close a loop: true if `dependsOn`
 * is the task itself, or already waits (directly or through others) for
 * `task`. `edges` maps each task to the tasks it waits for.
 */
export function wouldCreateCycle(
  task: string,
  dependsOn: string,
  edges: ReadonlyMap<string, readonly string[]>,
): boolean {
  const seen = new Set<string>();
  const queue = [dependsOn];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (current === task) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...(edges.get(current) ?? []));
  }
  return false;
}
