import { z } from "zod";
import { REASONS } from "#notifications/notification.util";

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "today must be YYYY-MM-DD");

/** `POST /notifications/sync`: the user's local day and time. */
export const syncNotificationsSchema = z.object({
  today: isoDay,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:mm (24h)"),
});
export type SyncNotificationsInput = z.infer<typeof syncNotificationsSchema>;

/** Which part of the inbox: GitHub's Inbox (with an unread filter), Saved and Done. */
export const NOTIFICATION_VIEWS = ["inbox", "unread", "saved", "done"] as const;

/** `GET /notifications` query string. */
export const listNotificationsSchema = z.object({
  view: z.enum(NOTIFICATION_VIEWS).default("inbox"),
  reason: z.enum(REASONS).optional(),
  first: z.coerce.number().int().min(1).max(100).default(30),
  after: z.string().max(200).optional(),
});
export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

/** `POST /notifications/mark`: set or clear read, done and saved on several at once. */
export const markNotificationsSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(200),
    read: z.boolean().optional(),
    done: z.boolean().optional(),
    saved: z.boolean().optional(),
  })
  .refine((m) => m.read !== undefined || m.done !== undefined || m.saved !== undefined, {
    message: "give at least one of read, done or saved",
  });
export type MarkNotificationsInput = z.infer<typeof markNotificationsSchema>;

/** `POST /notifications/read-all`: everything in the inbox, or one reason's. */
export const readAllSchema = z.object({ reason: z.enum(REASONS).optional() });
export type ReadAllInput = z.infer<typeof readAllSchema>;
