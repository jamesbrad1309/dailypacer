/** Same limits as the API's transaction and habit DTOs. */
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

/**
 * "holiday-2026, #Work expense" → ["holiday-2026", "work", "expense"].
 * Commas, spaces and a leading "#" all work, like the journal's #tags;
 * tags are lowercased and de-duplicated so "Work" and "work" are one tag.
 */
export function parseTags(text: string): string[] {
  const tags = text
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#+/, "").toLowerCase().slice(0, MAX_TAG_LENGTH))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

export function formatTags(tags: readonly string[]): string {
  return tags.join(", ");
}
