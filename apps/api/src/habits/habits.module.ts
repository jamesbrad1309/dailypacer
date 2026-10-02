import { Module } from "@nestjs/common";
import { HabitEntriesModule } from "#habit-entries/habit-entries.module";
import { DashboardController } from "#habits/dashboard.controller";
import { HabitRecordsService } from "#habits/habit-records.service";
import { HabitStatsService } from "#habits/habit-stats.service";
import { HabitsController } from "#habits/habits.controller";
import { HabitsService } from "#habits/habits.service";

@Module({
  imports: [HabitEntriesModule],
  controllers: [HabitsController, DashboardController],
  providers: [HabitsService, HabitStatsService, HabitRecordsService],
  exports: [HabitsService],
})
export class HabitsModule {}
