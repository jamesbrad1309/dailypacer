/**
 * Slows down password guessing: after MAX_FAILURES wrong passwords for one
 * email within WINDOW_MS, sign-in for it is refused until the window passes.
 * In memory, so per API process and reset on restart; enough for one
 * instance (docs/backend/auth.md).
 */
export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;

export class SignInThrottle {
  private readonly failures = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  private recent(key: string): number[] {
    const since = this.now() - WINDOW_MS;
    const kept = (this.failures.get(key) ?? []).filter((at) => at > since);
    if (kept.length) this.failures.set(key, kept);
    else this.failures.delete(key);
    return kept;
  }

  /** Milliseconds until another try is allowed, or 0 when it is. */
  retryAfter(key: string): number {
    const recent = this.recent(key);
    if (recent.length < MAX_FAILURES) return 0;
    return recent[0] + WINDOW_MS - this.now();
  }

  fail(key: string): void {
    this.failures.set(key, [...this.recent(key), this.now()]);
  }

  succeed(key: string): void {
    this.failures.delete(key);
  }
}
