import { z } from "zod";
import { isoDate, minor } from "#finance/dto/account.dto";

const nonZeroMinor = minor.refine((n) => n !== 0, "amount can't be zero");
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

/** The full form: any account, any date on or after the account's opening date. */
export const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  date: isoDate,
  /** Signed: negative = money out. */
  amountMinor: nonZeroMinor,
  payee: optionalText(200),
  note: optionalText(1000),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  /** PENDING: expected but not gone through yet; waits in "To review". Default CLEARED. */
  status: z.enum(["CLEARED", "PENDING"]).optional(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/** Only the fields sent change; `null` clears an optional one (e.g. back to "To review"). */
export const updateTransactionSchema = createTransactionSchema.partial();
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

/** `PUT /transactions/:id/splits`: the parts, or `[]` to undo the split (back to "To review"). */
export const setSplitsSchema = z.object({
  splits: z
    .array(
      z.object({
        categoryId: z.string().uuid(),
        amountMinor: nonZeroMinor,
        note: optionalText(200),
      }),
    )
    .max(20),
});
export type SetSplitsInput = z.infer<typeof setSplitsSchema>;

const flag = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

/** `GET /transactions` query string. */
export const listTransactionsSchema = z.object({
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().trim().max(100).optional(),
  /** Only transactions carrying this tag (tags are stored lowercased). */
  tag: z.string().trim().toLowerCase().min(1).max(50).optional(),
  /** No category, not a transfer. */
  uncategorised: flag,
  /** The whole "To review" inbox: uncategorised or pending. */
  toReview: flag,
  /** Default true. */
  includeTransfers: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
  first: z.coerce.number().int().min(1).max(200).default(50),
  after: z.string().max(200).optional(),
});
export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>;

/** Moving money between two of your own accounts: a card payment, a savings top-up, settling an IOU. */
export const createTransferSchema = z
  .object({
    fromAccountId: z.string().uuid(),
    toAccountId: z.string().uuid(),
    date: isoDate,
    /** Positive, in the source account's currency. */
    amountMinor: minor.positive(),
    /**
     * Positive, in the destination account's currency. Required when the two
     * currencies differ (what actually arrived); must be left out otherwise.
     */
    toAmountMinor: minor.positive().optional(),
    note: optionalText(1000),
    /** Client-generated: the same id twice records one transfer (double clicks, retries). */
    clientId: z.string().uuid().optional(),
  })
  .refine((t) => t.fromAccountId !== t.toAccountId, {
    message: "A transfer needs two different accounts",
    path: ["toAccountId"],
  });
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
