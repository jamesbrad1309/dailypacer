import { z } from "zod";

const aliases = z.array(z.string().trim().toLowerCase().min(1).max(40)).max(50);
/** "#rrggbb": a colour from the web app's palette. */
const color = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "color must be #rrggbb")
  .nullable()
  .optional();

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().max(16).nullable().optional(),
  color,
  kind: z.enum(["expense", "income"]).default("expense"),
  /** A top-level category of the same kind: "Food" for "Food › Eating out". */
  parentId: z.string().uuid().nullable().optional(),
  aliases: aliases.optional(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/** Only the fields sent change. A category's kind is fixed once it's made. */
export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  icon: z.string().trim().max(16).nullable().optional(),
  color,
  /** null makes it top-level. */
  parentId: z.string().uuid().nullable().optional(),
  aliases: aliases.optional(),
  /** true archives it (and its subcategories); false brings it back. */
  archived: z.boolean().optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const dismissPresetSuggestionSchema = z.object({
  /** "amountMinor|label", as QuickLogService.presetKey builds it. */
  key: z.string().min(1).max(250),
});
export type DismissPresetSuggestionInput = z.infer<typeof dismissPresetSuggestionSchema>;
