import { gql } from "@apollo/client";

const JOURNAL_ENTRY_FIELDS = gql`
  fragment JournalEntryFields on JournalEntry {
    id
    date
    kind
    time
    text
    tags
    durationMinutes
    emotion
    intensity
    tone
    trigger {
      id
      kind
      text
      time
      tags
      tone
    }
  }
`;

export const JOURNAL_ENTRIES_QUERY = gql`
  ${JOURNAL_ENTRY_FIELDS}
  query JournalEntries($date: String!) {
    journalEntries(date: $date) {
      ...JournalEntryFields
    }
  }
`;

export const JOURNAL_DAYS_QUERY = gql`
  query JournalDays($from: String!, $to: String!) {
    journalDays(from: $from, to: $to) {
      date
      actionCount
      feelingCount
      eventCount
      emotions
      feelings {
        emotion
        intensity
      }
    }
  }
`;

export const JOURNAL_FIRST_DATE_QUERY = gql`
  query JournalFirstDate {
    journalFirstDate
  }
`;

export const CREATE_JOURNAL_ENTRIES_MUTATION = gql`
  ${JOURNAL_ENTRY_FIELDS}
  mutation CreateJournalEntries($entries: [JournalEntryDraftInput!]!) {
    createJournalEntries(entries: $entries) {
      ...JournalEntryFields
    }
  }
`;

export const UPDATE_JOURNAL_ENTRY_MUTATION = gql`
  ${JOURNAL_ENTRY_FIELDS}
  mutation UpdateJournalEntry($id: ID!, $input: JournalEntryInput!) {
    updateJournalEntry(id: $id, input: $input) {
      ...JournalEntryFields
    }
  }
`;

export const DELETE_JOURNAL_ENTRY_MUTATION = gql`
  mutation DeleteJournalEntry($id: ID!) {
    deleteJournalEntry(id: $id)
  }
`;

/**
 * Creating/deleting changes list membership and the week strip's counts,
 * which cache normalization can't infer — refetch both active queries by
 * operation name after any journal write.
 */
export const JOURNAL_REFETCH = ["JournalEntries", "JournalDays", "JournalFirstDate"];

/** Across every day; see the BFF's `journalSearch`. */
export const JOURNAL_SEARCH_QUERY = gql`
  ${JOURNAL_ENTRY_FIELDS}
  query JournalSearch(
    $query: String
    $tag: String
    $kind: JournalEntryKind
    $limit: Int
    $offset: Int
  ) {
    journalSearch(query: $query, tag: $tag, kind: $kind, limit: $limit, offset: $offset) {
      total
      items {
        ...JournalEntryFields
      }
    }
  }
`;

/** Whole entries with their triggers' tags, for "which events drive which feelings". */
export const JOURNAL_RANGE_QUERY = gql`
  ${JOURNAL_ENTRY_FIELDS}
  query JournalRange($from: String!, $to: String!) {
    journalRange(from: $from, to: $to) {
      ...JournalEntryFields
    }
  }
`;

/** Feelings only, over long ranges: the mood streak and mood overlays. */
export const JOURNAL_FEELINGS_QUERY = gql`
  query JournalFeelings($from: String!, $to: String!) {
    journalFeelings(from: $from, to: $to) {
      date
      emotion
      intensity
    }
  }
`;
