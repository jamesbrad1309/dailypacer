import type { HabitSchedule } from "#graphql/types";

/**
 * Starting points for a new habit. Picking one only fills in the create
 * form, so everything stays editable and no template is stored. Names,
 * descriptions and units are translated: `habits.templates.<id>.*`.
 */
export interface HabitTemplate {
  id: TemplateId;
  emoji: string;
  target: number | null;
  startTime: string | null;
  schedule: HabitSchedule;
  /** Tag keys, lowercase, the same in every language. */
  tags: string[];
}

export type TemplateId =
  | "water"
  | "read"
  | "exercise"
  | "meditate"
  | "walk"
  | "journal"
  | "stretch"
  | "language";

export const HABIT_TEMPLATES: HabitTemplate[] = [
  {
    id: "water",
    emoji: "💧",
    target: 8,
    startTime: null,
    schedule: { type: "daily" },
    tags: ["health"],
  },
  {
    id: "read",
    emoji: "📖",
    target: 20,
    startTime: "21:30",
    schedule: { type: "daily" },
    tags: ["mind"],
  },
  {
    id: "exercise",
    emoji: "🏃",
    target: null,
    startTime: "07:00",
    schedule: { type: "timesPerWeek", count: 3 },
    tags: ["health"],
  },
  {
    id: "meditate",
    emoji: "🧘",
    target: 10,
    startTime: "07:30",
    schedule: { type: "daily" },
    tags: ["mind"],
  },
  {
    id: "walk",
    emoji: "🚶",
    target: 8000,
    startTime: null,
    schedule: { type: "daily" },
    tags: ["health"],
  },
  {
    id: "journal",
    emoji: "✍️",
    target: null,
    startTime: "22:00",
    schedule: { type: "daily" },
    tags: ["mind"],
  },
  {
    id: "stretch",
    emoji: "🤸",
    target: 10,
    startTime: "08:00",
    schedule: { type: "weekly", daysOfWeek: [1, 2, 3, 4, 5] },
    tags: ["health", "morning"],
  },
  {
    id: "language",
    emoji: "🗣️",
    target: 15,
    startTime: null,
    schedule: { type: "daily" },
    tags: ["learning"],
  },
];
