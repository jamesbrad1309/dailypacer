import { z } from "zod";

export const scheduleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily") }),
  z.object({ type: z.literal("weekly"), daysOfWeek: z.array(z.number().int().min(0).max(6)) }),
  z.object({ type: z.literal("timesPerWeek"), count: z.number().int().min(1).max(7) }),
  z.object({ type: z.literal("interval"), everyNDays: z.number().int().min(1) }),
]);

export const startTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "startTime must be HH:mm (24h)");

/** Lowercased and de-duplicated, so "Health" and "health" are one tag. */
export const habitTagsSchema = z
  .array(z.string().trim().toLowerCase().min(1).max(50))
  .max(20)
  .transform((tags) => [...new Set(tags)]);

/** The user's own fields on a habit, in order: [{ label: "Coach", value: "Sam" }]. */
export const customFieldsSchema = z
  .array(z.object({ label: z.string().trim().min(1).max(50), value: z.string().trim().max(500) }))
  .max(20);

/** "#rrggbb", lowercased: a swatch from the web app's palette (lib/colors.ts). */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "color must be #rrggbb")
  .transform((hex) => hex.toLowerCase());

export const polaritySchema = z.enum(["build", "avoid"]);
export const endDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD");

export const createHabitSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  tags: habitTagsSchema.optional(),
  icon: z.string().max(50).optional(),
  color: hexColorSchema.optional(),
  unit: z.string().max(50).optional(),
  targetValue: z.number().positive().optional(),
  startTime: startTimeSchema.optional(),
  schedule: scheduleSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** "avoid": a due day counts as done unless a slip is logged. */
  polarity: polaritySchema.optional(),
  /** A time-boxed habit's last day; it archives itself after. */
  endDate: endDateSchema.optional(),
  customFields: customFieldsSchema.optional(),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
