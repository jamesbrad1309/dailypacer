import type {
  Habit,
  HabitCustomField,
  HabitCustomFieldInput,
  HabitFieldType,
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

/**
 * A custom field row as edited, with a stable key so rows keep focus when
 * one is removed. A select's options are held as typed ("great, ok, bad").
 */
export type DraftField = Omit<HabitCustomField, "options"> & { key: number; options: string };

let nextFieldKey = 1;
export function draftField(field?: HabitCustomField): DraftField {
  return {
    key: nextFieldKey++,
    label: field?.label ?? "",
    type: field?.type ?? "TEXT",
    value: field?.value ?? "",
    options: field?.options.join(", ") ?? "",
  };
}

/** A select's choices from what was typed: comma-separated, trimmed, no blanks or repeats. */
export function parseOptions(text: string): string[] {
  return [
    ...new Set(
      text
        .split(",")
        .map((option) => option.trim())
        .filter(Boolean),
    ),
  ];
}

/** The row with another type: a value that doesn't fit the new type is cleared. */
export function changeFieldType(field: DraftField, type: HabitFieldType): DraftField {
  const changed = { ...field, type };
  return fieldIssue(changed) === "invalidValue" ? { ...changed, value: "" } : changed;
}

/** What stops a row being saved; rows without a label are dropped, so they never block. */
export function fieldIssue(field: DraftField): "needsOptions" | "invalidValue" | null {
  if (field.label.trim() === "") return null;
  const value = field.value.trim();
  if (field.type === "SELECT" && parseOptions(field.options).length === 0) return "needsOptions";
  if (value === "") return null;
  switch (field.type) {
    case "NUMBER":
      return Number.isFinite(Number(value)) ? null : "invalidValue";
    case "BOOLEAN":
      return value === "true" || value === "false" ? null : "invalidValue";
    case "DATE":
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : "invalidValue";
    case "SELECT":
      return parseOptions(field.options).includes(value) ? null : "invalidValue";
    case "TEXT":
      return null;
  }
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
    customFields: habit.customFields.map((field) => draftField(field)),
    financeSource: habit.financeSource,
    financeCategoryIds: habit.financeCategoryIds,
  };
}

/** Fields worth saving: a label is required; blank rows are dropped. Check fieldIssue first. */
export function cleanCustomFields(fields: DraftField[]): HabitCustomFieldInput[] {
  return fields
    .filter((f) => f.label.trim() !== "")
    .map((f) => ({
      label: f.label.trim(),
      type: f.type,
      value: f.value.trim(),
      ...(f.type === "SELECT" && { options: parseOptions(f.options) }),
    }));
}
