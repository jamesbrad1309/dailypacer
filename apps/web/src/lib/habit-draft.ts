import type { Habit, HabitSchedule } from "#graphql/types";
import { formatTags } from "#lib/tags";

/** A habit's fields as the create and edit forms hold them: text, as typed. */
export interface HabitDraft {
  name: string;
  description: string;
  /** Comma-separated, as typed; parseTags turns it into a list. */
  tags: string;
  unit: string;
  targetValue: string;
  /** "HH:mm" or "" for anytime. */
  startTime: string;
  schedule: HabitSchedule;
}

export type HabitDraftAction =
  | { [K in keyof HabitDraft]: { type: "set"; field: K; value: HabitDraft[K] } }[keyof HabitDraft]
  /** Replace every field: open the form fresh, or fill it from a template. */
  | { type: "reset"; draft: HabitDraft };

export function habitDraftReducer(draft: HabitDraft, action: HabitDraftAction): HabitDraft {
  switch (action.type) {
    case "set":
      return { ...draft, [action.field]: action.value };
    case "reset":
      return action.draft;
  }
}

export const BLANK_HABIT_DRAFT: HabitDraft = {
  name: "",
  description: "",
  tags: "",
  unit: "",
  targetValue: "",
  startTime: "",
  schedule: { type: "daily" },
};

/** The edit form's starting point: the habit as it is now. */
export function habitDraftFrom(habit: Habit): HabitDraft {
  return {
    name: habit.name,
    description: habit.description ?? "",
    tags: formatTags(habit.tags),
    unit: habit.unit ?? "",
    targetValue: habit.targetValue?.toString() ?? "",
    startTime: habit.startTime ?? "",
    schedule: habit.schedule,
  };
}
