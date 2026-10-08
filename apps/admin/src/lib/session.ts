/**
 * Session plumbing shared by the Apollo link (which notices an ended
 * session) and the router (which sends the person to sign-in).
 */

/** The API's password rule (apps/api/src/auth/password.ts). */
export const PASSWORD_MIN_LENGTH = 8;

/** Operations allowed to come back UNAUTHENTICATED without meaning "your session ended". */
export const SIGNED_OUT_OPERATIONS = new Set(["Me", "SignIn", "SignOut"]);

let onSessionEnded: (() => void) | undefined;

export function setSessionEndedHandler(handler: () => void): void {
  onSessionEnded = handler;
}

export function sessionEnded(): void {
  onSessionEnded?.();
}

/** Where to go after signing in: an in-app path only, never another site. */
export function safeRedirect(target: unknown): string {
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//")) return "/";
  if (target.startsWith("/\\") || /^\/sign-in\b/.test(target)) return "/";
  return target;
}
