import { Module } from "@nestjs/common";
import { FinanceModule } from "#finance/finance.module";
import { HabitsModule } from "#habits/habits.module";
import { NotificationSourcesService } from "#notifications/notification-sources.service";
import { NotificationsController } from "#notifications/notifications.controller";
import { NotificationsService } from "#notifications/notifications.service";

/**
 * The inbox. It reads tasks, money and habits to decide what's worth a
 * notification, so it imports finance and habits; neither imports it.
 */
@Module({
  imports: [FinanceModule, HabitsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationSourcesService],
})
export class NotificationsModule {}
