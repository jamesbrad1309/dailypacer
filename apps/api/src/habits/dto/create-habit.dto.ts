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

export const CUSTOM_FIELD_TYPES = ["text", "number", "boolean", "select", "date"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

/**
 * One of the user's own fields on a habit. `value` is always a string, so
 * fields saved before types existed (no `type`) read as text: a number as
 * "12.5", yes/no as "true"/"false", a date as "YYYY-MM-DD", a select as one
 * of its `options`. "" means not filled in, for every type.
 */
export const customFieldSchema = z
  .object({
    label: z.string().trim().min(1).max(50),
    type: z.enum(CUSTOM_FIELD_TYPES).default("text"),
    value: z.string().trim().max(500),
    /** A select's choices, in order; dropped for every other type. */
    options: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  })
  .transform(({ options, ...field }) =>
    field.type === "select" ? { ...field, options: [...new Set(options ?? [])] } : field,
  )
  .superRefine((field, ctx) => {
    const problem = customFieldProblem(field);
    if (problem) ctx.addIssue({ code: "custom", path: ["value"], message: problem });
  });

export type CustomField = z.infer<typeof customFieldSchema>;

/** Why a field's value doesn't fit its type, or null when it does. */
export function customFieldProblem(field: {
  type: CustomFieldType;
  value: string;
  options?: string[];
}): string | null {
  if (field.type === "select" && (field.options?.length ?? 0) === 0) {
    return "a select field needs at least one option";
  }
  if (field.value === "") return null;
  switch (field.type) {
    case "text":
      return null;
    case "number":
      return Number.isFinite(Number(field.value)) ? null : "must be a number";
    case "boolean":
      return field.value === "true" || field.value === "false" ? null : 'must be "true" or "false"';
    case "date": {
      const ok =
        /^\d{4}-\d{2}-\d{2}$/.test(field.value) &&
        new Date(`${field.value}T00:00:00Z`).toISOString().startsWith(field.value);
      return ok ? null : "must be a real date, YYYY-MM-DD";
    }
    case "select":
      return field.options?.includes(field.value) ? null : "must be one of the options";
  }
}

/** The user's own fields on a habit, in order: [{ label: "Coach", type: "text", value: "Sam" }]. */
export const customFieldsSchema = z.array(customFieldSchema).max(20);

export const polaritySchema = z.enum(["build", "avoid"]);
export const endDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD");

export const createHabitSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  tags: habitTagsSchema.optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
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
