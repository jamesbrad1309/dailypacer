/**
 * Which keyboard overlay is open: the command palette or the shortcuts
 * cheat sheet. A tiny external store, like lib/toast.ts, so a key binding,
 * a button or the palette itself can open either.
 */
export type Overlay = "palette" | "help" | null;

let current: Overlay = null;
const listeners = new Set<() => void>();

export function subscribeOverlay(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOverlay(): Overlay {
  return current;
}

export function setOverlay(overlay: Overlay): void {
  current = overlay;
  for (const listener of listeners) listener();
}

export function togglePalette(): void {
  setOverlay(current === "palette" ? null : "palette");
}

/**
 * Something the palette asks a page to do, which may not be mounted yet
 * (the palette navigates there first): "newHabit" opens Add habit.
 */
export type PendingAction = "newHabit";
let pending: PendingAction | null = null;
const actionListeners = new Set<() => void>();

export function requestAction(action: PendingAction): void {
  pending = action;
  for (const listener of actionListeners) listener();
}

/**
 * Runs `handler` once per request for `action`: one already waiting when the
 * page mounts, or one made while it's mounted. Returns the unsubscribe.
 */
export function onAction(action: PendingAction, handler: () => void): () => void {
  const check = () => {
    if (pending !== action) return;
    pending = null;
    handler();
  };
  check();
  actionListeners.add(check);
  return () => actionListeners.delete(check);
}
