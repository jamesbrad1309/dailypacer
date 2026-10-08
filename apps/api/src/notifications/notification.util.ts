/** What a notification is about: the inbox's filters. */
export const REASONS = ["task", "money", "habit", "achievement"] as const;
export type NotificationReason = (typeof REASONS)[number];

/**
 * Kinds that hold only while something stays true (a task overdue, money
 * to review). Once a sync no longer finds it, the notification is marked
 * done. The other kinds are events (a budget crossed, a badge earned) and
 * stay until the user clears them.
 */
export const ONGOING_KINDS = new Set([
  "task.dueToday",
  "task.overdue",
  "task.inbox",
  "money.toReview",
  "money.pendingCharges",
  "money.cardDue",
  "habit.due",
  "habit.streakAtRisk",
]);

export const reasonOf = (kind: string) => kind.split(".")[0] as NotificationReason;

/** A notification a source thinks should exist right now. */
export interface Candidate {
  key: string;
  kind: string;
  params: Record<string, unknown>;
  link: string | null;
  /**
   * What makes it worth seeing again: when this changes, it comes back to
   * the inbox unread ("due today" turning "overdue"). Other param changes
   * (a renamed task) update it quietly.
   */
  fingerprint: string;
  /** "grew": only a bigger number (a count) re-surfaces it, not a smaller one. */
  resurface?: "changed" | "grew";
}

/** The stored fields a sync compares against. */
export interface Existing {
  id: string;
  key: string;
  kind: string;
  params: unknown;
  link: string | null;
  fingerprint: string;
  doneAt: Date | null;
}

export interface SyncPlan {
  create: Candidate[];
  /** `resurface`: back to the inbox, unread, at the top. */
  update: { id: string; candidate: Candidate; resurface: boolean }[];
  /** Ongoing notifications whose condition has passed: mark them done. */
  resolve: string[];
}

/**
 * Turns what's true now into writes. `covered` are the ongoing kinds whose
 * sources ran this time; one that failed resolves nothing, so an error never
 * empties the inbox. `existing` holds every stored notification with a
 * candidate's key, plus every open one of a covered kind.
 */
export function planSync(
  existing: readonly Existing[],
  candidates: readonly Candidate[],
  covered: ReadonlySet<string>,
): SyncPlan {
  const byKey = new Map(existing.map((row) => [row.key, row]));
  const plan: SyncPlan = { create: [], update: [], resolve: [] };

  for (const candidate of candidates) {
    const row = byKey.get(candidate.key);
    if (!row) {
      plan.create.push(candidate);
      continue;
    }
    const resurface =
      row.fingerprint !== candidate.fingerprint &&
      (candidate.resurface === "grew"
        ? Number(candidate.fingerprint) > Number(row.fingerprint)
        : true);
    const changed =
      resurface ||
      row.fingerprint !== candidate.fingerprint ||
      row.kind !== candidate.kind ||
      row.link !== candidate.link ||
      JSON.stringify(row.params) !== JSON.stringify(candidate.params);
    if (changed) plan.update.push({ id: row.id, candidate, resurface });
  }

  const current = new Set(candidates.map((c) => c.key));
  for (const row of existing) {
    if (row.doneAt === null && covered.has(row.kind) && !current.has(row.key)) {
      plan.resolve.push(row.id);
    }
  }
  return plan;
}
