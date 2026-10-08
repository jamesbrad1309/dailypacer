import { GraphQLError } from "graphql";
import type { ApiMe, ApiSession, ApiUser } from "#clients/api-types";
import { clearSessionCookie, setSessionCookie } from "#common/session-cookie";
import type { GraphQLContext } from "#graphql/context";

function userAgent(ctx: GraphQLContext): string | undefined {
  return ctx.req.headers["user-agent"]?.slice(0, 500);
}

export default {
  Query: {
    me: async (_: unknown, __: unknown, ctx: GraphQLContext): Promise<ApiMe | null> => {
      if (!ctx.sessionToken) return null;
      try {
        return await ctx.api.get<ApiMe>("/auth/me");
      } catch (error) {
        // An expired or ended session: drop the stale cookie and say "not signed in".
        if (error instanceof GraphQLError && error.extensions.code === "UNAUTHENTICATED") {
          clearSessionCookie(ctx.req, ctx.res);
          return null;
        }
        throw error;
      }
    },
    users: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.api.get<ApiUser[]>("/users"),
  },
  Mutation: {
    signIn: async (_: unknown, args: { email: string; password: string }, ctx: GraphQLContext) => {
      const session = await ctx.api.post<ApiSession>("/auth/sign-in", {
        ...args,
        userAgent: userAgent(ctx),
      });
      setSessionCookie(ctx.req, ctx.res, session.token, session.expiresAt);
      return session.user;
    },
    signUp: async (
      _: unknown,
      args: { input: { email: string; name: string; password: string } },
      ctx: GraphQLContext,
    ) => {
      const result = await ctx.api.post<{
        user: ApiMe;
        session: Omit<ApiSession, "user"> | null;
      }>("/auth/sign-up", { ...args.input, userAgent: userAgent(ctx) });
      if (result.session)
        setSessionCookie(ctx.req, ctx.res, result.session.token, result.session.expiresAt);
      return { me: result.session ? result.user : null, status: result.user.status };
    },
    signOut: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (ctx.sessionToken) {
        // Clear the cookie even if the API call fails: the browser should end up signed out.
        await ctx.api.post("/auth/sign-out").catch(() => undefined);
      }
      clearSessionCookie(ctx.req, ctx.res);
      return true;
    },
    changePassword: async (
      _: unknown,
      args: { currentPassword: string; newPassword: string },
      ctx: GraphQLContext,
    ) => {
      await ctx.api.post("/auth/password", args);
      return true;
    },
    createUser: (
      _: unknown,
      args: { input: { email: string; name: string; password: string; role: string } },
      ctx: GraphQLContext,
    ) => ctx.api.post<ApiUser>("/users", args.input),
    updateUser: (
      _: unknown,
      args: { id: string; input: { name?: string; role?: string; status?: string } },
      ctx: GraphQLContext,
    ) => ctx.api.patch<ApiUser>(`/users/${encodeURIComponent(args.id)}`, args.input),
    resetUserPassword: async (
      _: unknown,
      args: { id: string; password: string },
      ctx: GraphQLContext,
    ) => {
      await ctx.api.post(`/users/${encodeURIComponent(args.id)}/password`, {
        password: args.password,
      });
      return true;
    },
  },
};
