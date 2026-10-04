const LEVELS = { near: "NEAR", reached: "REACHED" } as const;

/** The API's alert level ("near": 80%+, "reached": 100%+). */
export type BudgetAlertLevel = keyof typeof LEVELS;

/** The API's alert level as the GraphQL `BudgetAlert` enum. */
export const budgetAlert = (level: BudgetAlertLevel | null) => (level ? LEVELS[level] : null);
