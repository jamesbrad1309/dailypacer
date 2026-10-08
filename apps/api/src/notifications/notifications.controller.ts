import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import {
  type ListNotificationsInput,
  listNotificationsSchema,
  type MarkNotificationsInput,
  markNotificationsSchema,
  type ReadAllInput,
  readAllSchema,
  type SyncNotificationsInput,
  syncNotificationsSchema,
} from "#notifications/dto/notification.dto";
import { NotificationsService } from "#notifications/notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** `GET /notifications?view=inbox|unread|saved|done&reason&first&after`: newest first. */
  @Get()
  list(@Query(new ZodValidationPipe(listNotificationsSchema)) input: ListNotificationsInput) {
    return this.notifications.list(input);
  }

  /** `GET /notifications/counts`: inbox size and unread, overall and per reason. */
  @Get("counts")
  counts() {
    return this.notifications.counts();
  }

  /**
   * `POST /notifications/sync { today, time }`: bring the inbox up to date
   * with what's true now, in the user's day and time. Cheap to call often.
   */
  @Post("sync")
  sync(@Body(new ZodValidationPipe(syncNotificationsSchema)) input: SyncNotificationsInput) {
    return this.notifications.sync(input);
  }

  /** `POST /notifications/mark { ids, read?, done?, saved? }`. */
  @Post("mark")
  mark(@Body(new ZodValidationPipe(markNotificationsSchema)) input: MarkNotificationsInput) {
    return this.notifications.mark(input);
  }

  /** `POST /notifications/read-all { reason? }`. */
  @Post("read-all")
  readAll(@Body(new ZodValidationPipe(readAllSchema)) input: ReadAllInput) {
    return this.notifications.readAll(input);
  }
}
