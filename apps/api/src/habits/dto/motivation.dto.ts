import { z } from "zod";
import { startTimeSchema } from "#habits/dto/create-habit.dto";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

/** `?today=YYYY-MM-DD`: the user's local day. */
export const todayQuerySchema = z.object({ today: day });

export const rewardSchema = z.object({
  name: z.string().trim().min(1).max(80),
  emoji: z.string().trim().max(16).nullable().optional(),
  cost: z.number().int().min(1).max(1_000_000),
});
export type RewardInput = z.infer<typeof rewardSchema>;

/** Body of a freeze: the missed day, and the user's today. */
export const freezeSchema = z.object({ date: day, today: day });
export type FreezeInput = z.infer<typeof freezeSchema>;

export const challengeSchema = z.object({
  startDate: day,
  endDate: day,
  /** Check-ins needed in the range. */
  target: z.number().int().min(1).max(31),
  multiplier: z.number().min(1.5).max(3).default(2),
  today: day,
});
export type ChallengeInput = z.infer<typeof challengeSchema>;

export const routineSchema = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().max(16).nullable().optional(),
  startTime: startTimeSchema.nullable().optional(),
  /** In order. A habit in another routine moves to this one. */
  habitIds: z.array(z.string().uuid()).min(1).max(20),
});
export type RoutineInput = z.infer<typeof routineSchema>;
export const updateRoutineSchema = routineSchema.partial().extend({
  position: z.number().finite().optional(),
});
export type UpdateRoutineInput = z.infer<typeof updateRoutineSchema>;

/** `GET /habit-calendar?from&to&today`: at most 62 days. */
export const calendarQuerySchema = z.object({ from: day, to: day, today: day });
/** `?weeks=12&today=`: 1 to 52 weeks (the page asks for twice its period, to compare). */
export const progressQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(12),
  today: day,
});

/** `GET /habit-review/weekly?weekStart&today`: weekStart is a Monday. */
export const weeklyQuerySchema = z.object({ weekStart: day, today: day });
