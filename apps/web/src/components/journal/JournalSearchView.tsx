import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListSkeleton } from "#components/layout/Skeletons";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { JOURNAL_SEARCH_QUERY } from "#graphql/journal";
import type { JournalEntry, JournalEntryKind } from "#graphql/types";
import { useSyntaxLanguage } from "#hooks/useSyntaxLanguage";
import { formatDayHeading } from "#lib/dates";
import { emotionFor } from "#lib/emotions";
import { KIND_BY_ID, KINDS } from "#lib/journal-kinds";
import { emotionName } from "#lib/journal-syntax";
import { capitalizeFirst, cn } from "#lib/utils";

const PAGE = 25;

export interface JournalSearch {
  q?: string;
  tag?: string;
  kind?: JournalEntryKind;
}

/**
 * Search the whole journal: text or emotion, a #tag, a kind. Results are
 * grouped by day, newest first; each day opens its journal.
 */
export function JournalSearchView({
  search,
  onSearchChange,
}: {
  search: JournalSearch;
  onSearchChange: (next: Partial<JournalSearch>) => void;
}) {
  const { t } = useTranslation();
  const language = useSyntaxLanguage();
  const [limit, setLimit] = useState(PAGE);
  const filtered = Boolean(search.q || search.tag || search.kind);
  const { data, loading, error } = useQuery<{
    journalSearch: { items: JournalEntry[]; total: number };
  }>(JOURNAL_SEARCH_QUERY, {
    variables: {
      query: search.q ?? "",
      tag: search.tag ?? null,
      kind: search.kind ?? null,
      limit,
      offset: 0,
    },
    skip: !filtered,
  });
  const items = data?.journalSearch.items ?? [];
  const total = data?.journalSearch.total ?? 0;

  const days: { date: string; entries: JournalEntry[] }[] = [];
  for (const entry of items) {
    const last = days.at(-1);
    if (last?.date === entry.date) last.entries.push(entry);
    else days.push({ date: entry.date, entries: [entry] });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={search.q ?? ""} onChange={(q) => onSearchChange({ q: q || undefined })} />
        <fieldset className="flex gap-1">
          <legend className="sr-only">{t("journal.search.kind")}</legend>
          {KINDS.map(({ kind, icon: Icon }) => (
            <Button
              key={kind}
              size="sm"
              variant={search.kind === kind ? "default" : "outline"}
              aria-pressed={search.kind === kind}
              onClick={() => onSearchChange({ kind: search.kind === kind ? undefined : kind })}
            >
              <Icon className="size-3.5" /> {t(`journal.kinds.${kind}.label`)}
            </Button>
          ))}
        </fieldset>
        {search.tag && (
          <Button size="sm" variant="outline" onClick={() => onSearchChange({ tag: undefined })}>
            #{search.tag} <X className="size-3.5" aria-label={t("journal.search.clearTag")} />
          </Button>
        )}
      </div>

      {error && <p className="text-destructive">{error.message}</p>}
      {!filtered ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("journal.search.hint")}
        </p>
      ) : loading && !data ? (
        <ListSkeleton rows={4} />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("journal.search.none")}
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t("journal.search.results", { count: total })}
          </p>
          {days.map((day) => (
            <section key={day.date} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">
                <Link to="/journal" search={{ date: day.date }} className="hover:underline">
                  {formatDayHeading(day.date)}
                </Link>
              </h2>
              <ul className="divide-y rounded-xl border bg-card">
                {day.entries.map((entry) => {
                  const config = KIND_BY_ID[entry.kind];
                  const Icon = config.icon;
                  const emotion = entry.emotion ? emotionFor(entry.emotion) : null;
                  return (
                    <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                      <span
                        className={cn(
                          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                          config.dotClass,
                        )}
                        title={t(`journal.kinds.${entry.kind}.label`)}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        {emotion && (
                          <span className="mr-2 font-medium">
                            <span aria-hidden>{emotion.emoji}</span>{" "}
                            {capitalizeFirst(emotionName(emotion.name, language))}
                          </span>
                        )}
                        <Highlight text={entry.text} query={search.q ?? ""} />
                        {entry.tags.length > 0 && (
                          <span className="ml-2 inline-flex flex-wrap gap-1">
                            {entry.tags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => onSearchChange({ tag })}
                                className="text-xs text-sky-600 hover:underline dark:text-sky-400"
                              >
                                #{tag}
                              </button>
                            ))}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {entry.time ?? ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {items.length < total && (
            <Button
              variant="outline"
              className="self-center"
              disabled={loading}
              onClick={() => setLimit(limit + PAGE)}
            >
              {loading ? t("common.loading") : t("common.loadMore")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** The matched words in bold, without HTML from the entry ever being rendered. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one string, never reordered
          <mark key={i} className="rounded-sm bg-amber-300/40 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Updates the URL 300 ms after typing stops. */
function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => onChangeRef.current(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text, value]);
  return (
    <div className="relative min-w-56 flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        autoFocus
        aria-label={t("journal.search.placeholder")}
        placeholder={t("journal.search.placeholder")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="pl-8"
      />
    </div>
  );
}
