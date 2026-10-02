import type { Day } from "#habits/day.util";

/**
 * A stretch a habit was paused: from `start` (paused that day) up to, not
 * including, `end` (the day it was resumed). `end` is null while still paused.
 */
export interface PauseRange {
  start: Day;
  end: Day | null;
}

export function isPausedOn(pauses: readonly PauseRange[], day: Day): boolean {
  return pauses.some((pause) => pause.start <= day && (pause.end === null || day < pause.end));
}
