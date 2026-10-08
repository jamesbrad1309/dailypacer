import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type AuthedRequest, IS_PUBLIC, REQUIRED_ACTION } from "#auth/decorators";
import { type Action, decide, type Request } from "#auth/policy";
import { SessionsService } from "#auth/sessions.service";

/**
 * Runs before every route (registered globally in AuthModule): finds the
 * session from `Authorization: Bearer <token>` (the BFF forwards its cookie
 * this way), then asks the policy whether the route's action is allowed.
 * Routes are closed by default; @Public() opens one.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    const user = token ? await this.sessions.authenticate(token) : null;
    if (!user)
      throw new UnauthorizedException({ message: "Sign in to continue.", reason: "SIGNED_OUT" });
    req.user = user;
    req.sessionToken = token;

    const action =
      this.reflector.getAllAndOverride<Action>(REQUIRED_ACTION, targets) ??
      (req.method === "GET" || req.method === "HEAD" ? "app:read" : "app:write");
    // Actions about one user need that user's attributes (and the new role):
    // here only "may manage people at all"; UsersService decides the rest.
    const needsResource = action.startsWith("user:") || action === "users:create";
    const request = (needsResource ? { action: "users:list" } : { action }) as Request;
    const decision = decide(user, request);
    if (!decision.allowed) {
      throw new ForbiddenException({ message: decision.reason, reason: decision.code });
    }
    return true;
  }
}
