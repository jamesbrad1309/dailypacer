/**
 * Session plumbing shared by the Apollo link (which notices an ended
 * session) and the router (which sends the person to sign-in), without the
 * two importing each other.
 */

/** The API's password rule (apps/api/src/auth/password.ts). */
export const PASSWORD_MIN_LENGTH = 8;

/** Operations allowed to come back UNAUTHENTICATED without meaning "your session ended". */
export const SIGNED_OUT_OPERATIONS = new Set(["Me", "SignIn", "SignUp", "SignOut"]);

let onSessionEnded: (() => void) | undefined;

export function setSessionEndedHandler(handler: () => void): void {
  onSessionEnded = handler;
}

export function sessionEnded(): void {
  onSessionEnded?.();
}

/**
 * Where to go after signing in: an in-app path only. Anything else (another
 * site, "//evil.example", "javascript:") falls back to home, so a crafted
 * sign-in link can't bounce someone off the app.
 */
export function safeRedirect(target: unknown): string {
  if (typeof target !== "string" || !target.startsWith("/") || target.startsWith("//")) return "/";
  if (target.startsWith("/\\") || /^\/(sign-in|sign-up)\b/.test(target)) return "/";
  return target;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
