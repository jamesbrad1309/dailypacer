import { z } from "zod";

const pattern = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .refine((p) => p.replace(/\*/g, "").trim().length >= 2, "pattern needs some text, not just *");

export const createPayeeRuleSchema = z.object({
  /** "TESCO*", "*amazon*", or plain text matched anywhere in the payee. */
  pattern,
  categoryId: z.string().uuid(),
});
export type CreatePayeeRuleInput = z.infer<typeof createPayeeRuleSchema>;

export const updatePayeeRuleSchema = z.object({
  pattern: pattern.optional(),
  categoryId: z.string().uuid().optional(),
  /** Lower runs first. */
  sortOrder: z.number().int().optional(),
});
export type UpdatePayeeRuleInput = z.infer<typeof updatePayeeRuleSchema>;
