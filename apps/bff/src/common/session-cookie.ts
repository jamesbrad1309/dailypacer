import type { Request, Response } from "express";
import { env } from "#common/config/env";

/**
 * The browser's session lives in one httpOnly cookie holding the API's
 * session token. Scripts can't read it, and SameSite=Lax keeps other sites'
 * forms and fetches from sending it. The BFF passes the token to the API as
 * `Authorization: Bearer`; the API decides everything else.
 */
export const SESSION_COOKIE = "dailypacer_session";

export function readSessionToken(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE && value.length) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

/** Secure when the browser came over HTTPS (directly, or via a proxy that says so). */
function isSecure(req: Request): boolean {
  if (env.SESSION_COOKIE_SECURE !== "auto") return env.SESSION_COOKIE_SECURE === "true";
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}

export function setSessionCookie(req: Request, res: Response, token: string, expiresAt: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(req),
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(req),
    path: "/",
  });
}

/** Headers that carry the session to the API, for routes that call it with fetch directly. */
export function authHeaders(req: Request): Record<string, string> {
  const token = readSessionToken(req);
  return token ? { authorization: `Bearer ${token}` } : {};
}
