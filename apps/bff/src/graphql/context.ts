import type { Request, Response } from "express";
import type { Logger } from "pino";
import { ApiClient } from "#clients/api-client";
import { logger } from "#common/logger/logger";
import { readSessionToken } from "#common/session-cookie";
import { createLoaders, type Loaders } from "#graphql/loaders";

export interface GraphQLContext {
  /** Per-request logger (pino-http's `req.log`) — shares the request id with the access log line. */
  log: Logger;
  api: ApiClient;
  loaders: Loaders;
  /** For the auth resolvers, which set and clear the session cookie. */
  req: Request;
  res: Response;
  /** The browser's session token, if it sent one. */
  sessionToken?: string;
}

/** Built once per GraphQL request, so the ApiClient and loaders are request-scoped too. */
export function buildContext(req: Request, res: Response): GraphQLContext {
  const log = req.log ?? logger;
  const requestId = String(req.id ?? "");
  const sessionToken = readSessionToken(req);
  const api = new ApiClient(requestId, log, sessionToken);
  const today = new Date().toISOString().slice(0, 10);

  return { log, api, loaders: createLoaders(api, today), req, res, sessionToken };
}
