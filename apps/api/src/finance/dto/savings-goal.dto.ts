import { z } from "zod";
import { isoDate, minor } from "#finance/dto/account.dto";

export const createSavingsGoalSchema = z.object({
  name: z.string().trim().min(1).max(60),
  emoji: z.string().trim().max(16).nullable().optional(),
  targetMinor: minor.positive(),
  deadline: isoDate.nullable().optional(),
  /** Linked: the account's balance is what's saved, in its currency. */
  accountId: z.string().uuid().nullable().optional(),
  /** Unlinked only: what's already put aside. */
  savedMinor: minor.min(0).optional(),
  /** The client's local day: progress is measured from it. */
  today: isoDate,
});
export type CreateSavingsGoalInput = z.infer<typeof createSavingsGoalSchema>;

/** Only the fields sent change; `null` clears the deadline or unlinks the account. */
export const updateSavingsGoalSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  emoji: z.string().trim().max(16).nullable().optional(),
  targetMinor: minor.positive().optional(),
  deadline: isoDate.nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  archived: z.boolean().optional(),
  today: isoDate,
});
export type UpdateSavingsGoalInput = z.infer<typeof updateSavingsGoalSchema>;

/** Money put into (positive) or taken out of (negative) an unlinked goal. */
export const contributeSchema = z.object({
  amountMinor: minor.refine((n) => n !== 0, "amount can't be zero"),
  today: isoDate,
});
export type ContributeInput = z.infer<typeof contributeSchema>;

export const goalsQuerySchema = z.object({
  today: isoDate,
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});
