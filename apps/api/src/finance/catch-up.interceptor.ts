import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { from, type Observable, switchMap } from "rxjs";
import { scopedLogger } from "#common/logger/logger";
import { toIsoDate } from "#finance/calendar.util";
import { SubscriptionsService } from "#finance/subscriptions.service";

const log = scopedLogger("CatchUpInterceptor");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Brings auto-logged subscription charges up to date before a finance
 * request is handled, so balances, lists and reports never miss one that
 * fell due since the last visit. There's no cron job: like the rest of
 * recurring generation, it happens lazily. Uses the client's `?today=` when
 * the request carries one, else the server's day. A failure is logged and
 * never fails the request.
 */
@Injectable()
export class CatchUpInterceptor implements NestInterceptor {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const query = context.switchToHttp().getRequest<Request>().query;
    const today =
      typeof query.today === "string" && ISO_DATE.test(query.today)
        ? query.today
        : toIsoDate(new Date());
    return from(
      this.subscriptions.catchUp(today).catch((err) => {
        log.error({ err, today }, "auto-log catch-up failed");
      }),
    ).pipe(switchMap(() => next.handle()));
  }
}
