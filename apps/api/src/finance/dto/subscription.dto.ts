import { z } from "zod";
import { isoDate, minor } from "#finance/dto/account.dto";

const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** "https://www.Netflix.com/browse" → "netflix.com"; null when it isn't a hostname. */
export function normaliseDomain(input: string): string | null {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#:].*$/, "")
    .replace(/^www\./, "");
  return DOMAIN.test(host) ? host : null;
}

/** A website, stored as its bare hostname so every copy shares one cached logo. */
export const domain = z
  .string()
  .max(300)
  .transform((value, ctx) => {
    const host = normaliseDomain(value);
    if (!host)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a website, like netflix.com" });
    return host ?? z.NEVER;
  });

const interval = z.enum(["WEEK", "MONTH", "YEAR"]);
const price = minor.positive();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const createSubscriptionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  serviceKey: z.string().max(50).nullable().optional(),
  domain: domain.nullable().optional(),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  amountMinor: price,
  interval: interval.default("MONTH"),
  intervalCount: z.number().int().min(1).max(52).default(1),
  /** The next charge; later ones count from it. After a free trial, the day it ends. */
  nextChargeOn: isoDate,
  trialEndsOn: isoDate.nullable().optional(),
  note: optionalText(500),
  /** The client's calendar day: charges before it are never asked about. */
  today: isoDate,
});
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

/** Only the fields sent change. The price has its own endpoint, to keep history. */
export const updateSubscriptionSchema = createSubscriptionSchema
  .omit({ amountMinor: true, today: true })
  .partial();
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

export const changePriceSchema = z.object({
  amountMinor: price,
  /** The first charge date the new price applies to. */
  effectiveFrom: isoDate,
});
export type ChangePriceInput = z.infer<typeof changePriceSchema>;

export const todaySchema = z.object({ today: isoDate });
export type TodayInput = z.infer<typeof todaySchema>;

export const cancelSchema = z.object({
  /** The first day without the service; charges on or after it stop. */
  endsOn: isoDate,
});
export type CancelInput = z.infer<typeof cancelSchema>;

export const chargeSchema = z.object({ dueOn: isoDate });
export type ChargeInput = z.infer<typeof chargeSchema>;

export const confirmChargeSchema = chargeSchema.extend({
  /** What was actually taken, if not the listed price (e.g. after currency conversion). */
  amountMinor: price.optional(),
  /** When it left the account, if not the due date. */
  date: isoDate.optional(),
});
export type ConfirmChargeInput = z.infer<typeof confirmChargeSchema>;

export const chargeRangeSchema = z.object({
  from: isoDate,
  to: isoDate,
  today: isoDate,
});
export type ChargeRangeInput = z.infer<typeof chargeRangeSchema>;

export const listSubscriptionsSchema = z.object({
  today: isoDate,
  /** Also list cancelled subscriptions whose end date has passed. */
  includeEnded: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});
export type ListSubscriptionsInput = z.infer<typeof listSubscriptionsSchema>;

export const searchServicesSchema = z.object({ q: z.string().max(100).optional() });
