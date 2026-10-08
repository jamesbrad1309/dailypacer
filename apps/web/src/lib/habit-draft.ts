import type {
  Habit,
  HabitCustomField,
  HabitFinanceSource,
  HabitPolarity,
  HabitSchedule,
} from "#graphql/types";
import { formatTags } from "#lib/tags";

/** A habit's fields as the create and edit forms hold them: text, as typed. */
export interface HabitDraft {
  name: string;
  /** An emoji, or "" for none. */
  icon: string;
  /** A hex from lib/colors.ts, or null for none. */
  color: string | null;
  description: string;
  /** Comma-separated, as typed; parseTags turns it into a list. */
  tags: string;
  unit: string;
  targetValue: string;
  /** "HH:mm" or "" for anytime. */
  startTime: string;
  schedule: HabitSchedule;
  polarity: HabitPolarity;
  /** "YYYY-MM-DD" or "" for open-ended. */
  endDate: string;
  customFields: DraftField[];
  /** Set by a finance template; only sent on create. */
  financeSource: HabitFinanceSource | null;
  /** A no-spend habit's categories; empty counts all spending. */
  financeCategoryIds: string[];
}

/** A custom field row as edited, with a stable key so rows keep focus when one is removed. */
export type DraftField = HabitCustomField & { key: number };

let nextFieldKey = 1;
export function draftField(label = "", value = ""): DraftField {
  return { key: nextFieldKey++, label, value };
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
  icon: "",
  color: null,
  description: "",
  tags: "",
  unit: "",
  targetValue: "",
  startTime: "",
  schedule: { type: "daily" },
  polarity: "BUILD",
  endDate: "",
  customFields: [],
  financeSource: null,
  financeCategoryIds: [],
};

/** The edit form's starting point: the habit as it is now. */
export function habitDraftFrom(habit: Habit): HabitDraft {
  return {
    name: habit.name,
    icon: habit.icon ?? "",
    color: habit.color,
    description: habit.description ?? "",
    tags: formatTags(habit.tags),
    unit: habit.unit ?? "",
    targetValue: habit.targetValue?.toString() ?? "",
    startTime: habit.startTime ?? "",
    schedule: habit.schedule,
    polarity: habit.polarity,
    endDate: habit.endDate ?? "",
    customFields: habit.customFields.map(({ label, value }) => draftField(label, value)),
    financeSource: habit.financeSource,
    financeCategoryIds: habit.financeCategoryIds,
  };
}

/** Fields worth saving: a label is required; blank rows are dropped. */
export function cleanCustomFields(fields: DraftField[]): HabitCustomField[] {
  return fields
    .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
    .filter((f) => f.label !== "");
}
