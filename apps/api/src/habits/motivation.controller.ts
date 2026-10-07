import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import {
  type ChallengeInput,
  calendarQuerySchema,
  challengeSchema,
  type FreezeInput,
  freezeSchema,
  progressQuerySchema,
  type RewardInput,
  type RoutineInput,
  rewardSchema,
  routineSchema,
  todayQuerySchema,
  type UpdateRoutineInput,
  updateRoutineSchema,
  weeklyQuerySchema,
} from "#habits/dto/motivation.dto";
import { HabitReviewService } from "#habits/habit-review.service";
import { PointsService } from "#habits/points.service";
import { RoutinesService } from "#habits/routines.service";

const today = new ZodValidationPipe(todayQuerySchema);

/**
 * Points, rewards, streak freezes, challenges and routines, and the views
 * across habits (calendar, weekly review, achievements, correlations).
 * Kept apart from HabitsController so its `:id` routes don't shadow these.
 */
@Controller()
export class MotivationController {
  constructor(
    private readonly points: PointsService,
    private readonly review: HabitReviewService,
    private readonly routines: RoutinesService,
  ) {}

  // ─── Views ──────────────────────────────────────────────────────────────

  /** `GET /habit-calendar?from&to&today`: each active habit's day statuses. */
  @Get("habit-calendar")
  calendar(
    @Query(new ZodValidationPipe(calendarQuerySchema)) q: {
      from: string;
      to: string;
      today: string;
    },
  ) {
    return this.review.calendar(q.from, q.to, q.today);
  }

  @Get("habit-review/weekly")
  weekly(@Query(new ZodValidationPipe(weeklyQuerySchema)) q: { weekStart: string; today: string }) {
    return this.review.weekly(q.weekStart, q.today);
  }

  /** `GET /habit-review/progress?weeks=12&today`: habits week by week. */
  @Get("habit-review/progress")
  progress(@Query(new ZodValidationPipe(progressQuerySchema)) q: { weeks: number; today: string }) {
    return this.review.progress(q.weeks, q.today);
  }

  @Get("habit-review/achievements")
  achievements(@Query(today) q: { today: string }) {
    return this.review.achievements(q.today);
  }

  @Get("habit-review/correlations")
  correlations(@Query(today) q: { today: string }) {
    return this.review.correlations(q.today);
  }

  // ─── Points and rewards ─────────────────────────────────────────────────

  /** `GET /points?today`: earned, spent, balance and the latest spends. */
  @Get("points")
  wallet(@Query(today) q: { today: string }) {
    return this.points.wallet(q.today);
  }

  @Delete("points/spends/:id")
  undoSpend(@Param("id") id: string) {
    return this.points.undoSpend(id);
  }

  @Get("rewards")
  rewards() {
    return this.points.rewards();
  }

  @Post("rewards")
  createReward(@Body(new ZodValidationPipe(rewardSchema)) input: RewardInput) {
    return this.points.createReward(input);
  }

  @Patch("rewards/:id")
  updateReward(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(rewardSchema)) input: RewardInput,
  ) {
    return this.points.updateReward(id, input);
  }

  @Delete("rewards/:id")
  archiveReward(@Param("id") id: string) {
    return this.points.archiveReward(id);
  }

  @Post("rewards/:id/redeem")
  redeem(@Param("id") id: string, @Body(today) body: { today: string }) {
    return this.points.redeem(id, body.today);
  }

  // ─── Freezes and challenges ─────────────────────────────────────────────

  @Post("habits/:id/freezes")
  freeze(@Param("id") id: string, @Body(new ZodValidationPipe(freezeSchema)) input: FreezeInput) {
    return this.points.freeze(id, input);
  }

  @Delete("habits/:id/freezes/:date")
  unfreeze(@Param("id") id: string, @Param("date") date: string) {
    return this.points.unfreeze(id, date);
  }

  @Get("challenges")
  challenges(@Query(today) q: { today: string }) {
    return this.points.challenges(q.today);
  }

  @Post("habits/:id/challenges")
  createChallenge(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(challengeSchema)) input: ChallengeInput,
  ) {
    return this.points.createChallenge(id, input);
  }

  @Delete("challenges/:id")
  deleteChallenge(@Param("id") id: string) {
    return this.points.deleteChallenge(id);
  }

  // ─── Routines ───────────────────────────────────────────────────────────

  @Get("routines")
  listRoutines() {
    return this.routines.list();
  }

  @Post("routines")
  createRoutine(@Body(new ZodValidationPipe(routineSchema)) input: RoutineInput) {
    return this.routines.create(input);
  }

  @Patch("routines/:id")
  updateRoutine(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRoutineSchema)) input: UpdateRoutineInput,
  ) {
    return this.routines.update(id, input);
  }

  @Delete("routines/:id")
  deleteRoutine(@Param("id") id: string) {
    return this.routines.remove(id);
  }
}
