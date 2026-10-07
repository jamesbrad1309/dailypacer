import { Module } from "@nestjs/common";
import { HabitEntriesModule } from "#habit-entries/habit-entries.module";
import { DashboardController } from "#habits/dashboard.controller";
import { HabitHistoryService } from "#habits/habit-history.service";
import { HabitRecordsService } from "#habits/habit-records.service";
import { HabitReviewService } from "#habits/habit-review.service";
import { HabitStatsService } from "#habits/habit-stats.service";
import { HabitsController } from "#habits/habits.controller";
import { HabitsService } from "#habits/habits.service";
import { MotivationController } from "#habits/motivation.controller";
import { PointsService } from "#habits/points.service";
import { RoutinesService } from "#habits/routines.service";

@Module({
  imports: [HabitEntriesModule],
  controllers: [HabitsController, DashboardController, MotivationController],
  providers: [
    HabitsService,
    HabitStatsService,
    HabitRecordsService,
    HabitHistoryService,
    HabitReviewService,
    PointsService,
    RoutinesService,
  ],
  // HabitStatsService: finance's DailyPacer level adds its XP to habit points.
  exports: [HabitsService, HabitStatsService],
})
export class HabitsModule {}
