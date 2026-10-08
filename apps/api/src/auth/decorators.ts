import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Request } from "express";
import type { Action } from "#auth/policy";
import type { AuthUser } from "#auth/sessions.service";

export const IS_PUBLIC = "auth:public";
export const REQUIRED_ACTION = "auth:action";

/** No session needed (sign-in, sign-up, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * The policy action a route needs, checked by AuthGuard before the handler.
 * Without it, GET/HEAD need `app:read` and anything else `app:write`. Checks
 * that need the resource (the user being changed) happen in the service.
 */
export const Authorize = (action: Action) => SetMetadata(REQUIRED_ACTION, action);

export type AuthedRequest = Request & { user?: AuthUser; sessionToken?: string };

/** The signed-in user, set by AuthGuard. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  if (!user) throw new Error("CurrentUser used on a route without a session");
  return user;
});

/** The raw session token (for sign-out). */
export const SessionToken = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest<AuthedRequest>().sessionToken ?? "",
);
