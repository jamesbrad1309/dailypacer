import { Injectable } from "@nestjs/common";
import type { HabitEntry, Prisma } from "@prisma/client";
import { PrismaService } from "#common/database/prisma.service";
import { addDays, type Day, toDay } from "#habits/day.util";
import {
  type HabitInsights,
  habitInsights,
  WEEKDAY_WINDOW_DAYS,
} from "#habits/habit-insights.util";
import {
  computeMisses,
  MISSED_DAYS_LIMIT,
  type Miss,
  missesByWeek,
  type RecordFilter,
  type RecordStatus,
  statusOf,
  trackedSince,
} from "#habits/habit-records.util";
import { HabitsService } from "#habits/habits.service";
import { avoidEntries } from "#habits/polarity.util";
import type { HabitSchedule } from "#habits/schedule.util";

export interface HabitRecord {
  date: Day;
  status: RecordStatus;
  entry: (Omit<HabitEntry, "date"> & { date: Day }) | null;
  week: Miss["week"] | null;
}

export interface HabitRecordsPage {
  items: HabitRecord[];
  /** Rows matching the filter, across all pages. */
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; done: number; notDone: number; missed: number };
  trackedSince: Day;
  /** True when misses are whole weeks ("times a week" habits). */
  missesByWeek: boolean;
}

interface Query {
  filter: RecordFilter;
  page: number;
  pageSize: number;
  /** The user's local today: today and this week are never missed. */
  today: Day;
}

const toRecord =
  (polarity: string) =>
  (entry: HabitEntry): HabitRecord => {
    const date = toDay(entry.date);
    return { date, status: statusOf(entry, polarity), entry: { ...entry, date }, week: null };
  };

const fromMiss = (miss: Miss): HabitRecord => ({
  date: miss.date,
  status: miss.status,
  entry: null,
  week: miss.week ?? null,
});

/**
 * A habit's tracking records, one page at a time: stored entries plus the
 * misses worked out from its schedule and pause history. Done / not done
 * pages come straight from the database; "all" merges in the misses, which
 * are bounded (a year of days, or 53 weeks), and reads only as many entries
 * as the requested page needs, never the whole history.
 */
@Injectable()
export class HabitRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly habitsService: HabitsService,
  ) {}

  async records(
    habitId: string,
    { filter, page, pageSize, today }: Query,
  ): Promise<HabitRecordsPage> {
    const habit = await this.habitsService.findOneOrFail(habitId);
    const schedule = habit.schedule as HabitSchedule;

    const [earliest, done, notDone, pauses] = await Promise.all([
      this.prisma.habitEntry.findFirst({
        where: { habitId },
        orderBy: { date: "asc" },
        select: { date: true },
      }),
      this.prisma.habitEntry.count({ where: { habitId, completed: true } }),
      this.prisma.habitEntry.count({ where: { habitId, completed: false } }),
      this.habitsService.pausesFor([habitId]),
    ]);
    const since = trackedSince(toDay(habit.createdAt), earliest ? toDay(earliest.date) : null);

    // Only the misses window's days are needed to work out misses.
    const windowStart = addDays(today, -MISSED_DAYS_LIMIT - 7);
    const windowEntries = await this.prisma.habitEntry.findMany({
      where: { habitId, date: { gte: new Date(windowStart > since ? windowStart : since) } },
      select: { date: true, completed: true },
    });
    // An avoid habit's slips are entries; a day without one isn't a miss.
    const misses =
      habit.polarity === "avoid"
        ? []
        : computeMisses({
            schedule,
            since,
            today,
            logged: new Set(windowEntries.map((entry) => toDay(entry.date))),
            completed: new Set(windowEntries.filter((e) => e.completed).map((e) => toDay(e.date))),
            pauses: pauses.get(habitId) ?? [],
          });

    const offset = (page - 1) * pageSize;
    const counts = { all: done + notDone + misses.length, done, notDone, missed: misses.length };
    const entryPage = (where: Prisma.HabitEntryWhereInput, skip: number, take: number) =>
      this.prisma.habitEntry.findMany({
        where: { habitId, ...where },
        orderBy: { date: "desc" },
        skip,
        take,
      });

    let items: HabitRecord[];
    let total: number;
    switch (filter) {
      case "DONE":
        items = (await entryPage({ completed: true }, offset, pageSize)).map(
          toRecord(habit.polarity),
        );
        total = done;
        break;
      case "NOT_DONE":
        items = (await entryPage({ completed: false }, offset, pageSize)).map(
          toRecord(habit.polarity),
        );
        total = notDone;
        break;
      case "MISSED":
        items = misses.slice(offset, offset + pageSize).map(fromMiss);
        total = misses.length;
        break;
      default: {
        // The newest offset+pageSize rows overall are among the newest
        // offset+pageSize entries plus the misses, so that's all it reads.
        const entries = (await entryPage({}, 0, offset + pageSize)).map(toRecord(habit.polarity));
        items = [...entries, ...misses.map(fromMiss)]
          .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
          .slice(offset, offset + pageSize);
        total = counts.all;
      }
    }

    return {
      items,
      total,
      page,
      pageSize,
      counts,
      trackedSince: since,
      missesByWeek: missesByWeek(schedule),
    };
  }

  /** Best/worst weekdays and this month vs last month; see habit-insights.util.ts. */
  async insights(habitId: string, today: Day): Promise<HabitInsights> {
    const habit = await this.habitsService.findOneOrFail(habitId);
    const lastMonthStart = `${addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
    const weekdayStart = addDays(today, -WEEKDAY_WINDOW_DAYS);
    const windowStart = lastMonthStart < weekdayStart ? lastMonthStart : weekdayStart;

    const [earliest, entries, pauses] = await Promise.all([
      this.prisma.habitEntry.findFirst({
        where: { habitId },
        orderBy: { date: "asc" },
        select: { date: true },
      }),
      this.prisma.habitEntry.findMany({
        where: { habitId, completed: true, date: { gte: new Date(windowStart) } },
        select: { date: true },
      }),
      this.habitsService.pausesFor([habitId]),
    ]);
    const schedule = habit.schedule as HabitSchedule;
    const since = trackedSince(toDay(habit.createdAt), earliest ? toDay(earliest.date) : null);
    const ranges = pauses.get(habitId) ?? [];
    let completed = new Set(entries.map((entry) => toDay(entry.date)));
    if (habit.polarity === "avoid") {
      // Clean days are an avoid habit's check-ins; slips are its entries.
      const slips = await this.prisma.habitEntry.findMany({
        where: { habitId, date: { gte: new Date(windowStart) } },
        select: { date: true, completed: true, value: true },
      });
      completed = new Set(
        avoidEntries(slips, {
          schedule,
          since: windowStart > since ? windowStart : since,
          today,
          pauses: ranges,
        })
          .filter((e) => e.completed)
          .map((e) => toDay(e.date)),
      );
    }
    return habitInsights({ schedule, since, today, completed, pauses: ranges });
  }
}
