import { z } from "zod";
import {
  customFieldsSchema,
  endDateSchema,
  habitTagsSchema,
  polaritySchema,
  scheduleSchema,
  startTimeSchema,
} from "#habits/dto/create-habit.dto";

export const updateHabitSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  tags: habitTagsSchema.optional(),
  icon: z.string().max(50).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  targetValue: z.number().positive().nullable().optional(),
  startTime: startTimeSchema.nullable().optional(),
  schedule: scheduleSchema.optional(),
  polarity: polaritySchema.optional(),
  /** null makes it open-ended again. */
  endDate: endDateSchema.nullable().optional(),
  /** Replaces the list. */
  customFields: customFieldsSchema.optional(),
  /** A no-spend habit's categories (`metadata.categoryIds`, read by finance); [] means all spending. */
  financeCategoryIds: z.array(z.string().uuid()).max(100).optional(),
});

export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
