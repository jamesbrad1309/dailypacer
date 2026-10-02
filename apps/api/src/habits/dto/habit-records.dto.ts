import { z } from "zod";
import { ISO_DAY, toDay } from "#habits/day.util";

const day = z.string().regex(ISO_DAY, "must be YYYY-MM-DD");

/** `GET /habits/:id/records?filter=MISSED&page=2&pageSize=25&today=2026-10-02` */
export const habitRecordsQuerySchema = z.object({
  filter: z.enum(["ALL", "DONE", "NOT_DONE", "MISSED"]).default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  today: day.default(() => toDay(new Date())),
});
export type HabitRecordsQuery = z.infer<typeof habitRecordsQuerySchema>;

/** `GET /habits/:id/insights?today=2026-10-02` */
export const habitInsightsQuerySchema = z.object({ today: day.default(() => toDay(new Date())) });
export type HabitInsightsQuery = z.infer<typeof habitInsightsQuerySchema>;

/** Body of pause/resume: the user's local day, so the pause lines up with their calendar. */
export const pauseDaySchema = z.object({ date: day.optional() }).default({});
export type PauseDayInput = z.infer<typeof pauseDaySchema>;
