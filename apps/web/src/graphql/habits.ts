import { gql } from "@apollo/client";

const HABIT_FIELDS = gql`
  fragment HabitFields on Habit {
    id
    name
    icon
    unit
    targetValue
    startTime
    schedule
    paused
    currentStreak
    longestStreak
    totalCompletions
    points
    level
    levelTitle
    todayEntry {
      id
      value
      completed
      note
    }
    heatmap {
      date
      completed
      value
    }
  }
`;

export const HABITS_QUERY = gql`
  ${HABIT_FIELDS}
  query Habits {
    habits {
      ...HabitFields
    }
  }
`;

/** Lean on purpose: the archived list shows a name and a Restore button, not stats. */
export const ARCHIVED_HABITS_QUERY = gql`
  query ArchivedHabits {
    archivedHabits {
      id
      name
      icon
      archivedAt
    }
  }
`;

export const DASHBOARD_STATS_QUERY = gql`
  query DashboardStats {
    dashboardStats {
      totalHabits
      pausedHabits
      totalPoints
      level
      levelTitle
      pointsIntoLevel
      pointsForNextLevel
      longestOverallStreak
      activeStreakCount
    }
  }
`;

export const CREATE_HABIT_MUTATION = gql`
  ${HABIT_FIELDS}
  mutation CreateHabit($input: CreateHabitInput!) {
    createHabit(input: $input) {
      ...HabitFields
    }
  }
`;

export const UPDATE_HABIT_MUTATION = gql`
  ${HABIT_FIELDS}
  mutation UpdateHabit($id: ID!, $input: UpdateHabitInput!) {
    updateHabit(id: $id, input: $input) {
      ...HabitFields
    }
  }
`;

export const UPSERT_HABIT_ENTRY_MUTATION = gql`
  mutation UpsertHabitEntry($input: UpsertHabitEntryInput!) {
    upsertHabitEntry(input: $input) {
      id
      habitId
      date
      value
      completed
      note
    }
  }
`;

export const ARCHIVE_HABIT_MUTATION = gql`
  mutation ArchiveHabit($id: ID!) {
    archiveHabit(id: $id) {
      id
    }
  }
`;

export const UNARCHIVE_HABIT_MUTATION = gql`
  mutation UnarchiveHabit($id: ID!) {
    unarchiveHabit(id: $id) {
      id
    }
  }
`;

export const PAUSE_HABIT_MUTATION = gql`
  ${HABIT_FIELDS}
  mutation PauseHabit($id: ID!) {
    pauseHabit(id: $id) {
      ...HabitFields
    }
  }
`;

export const RESUME_HABIT_MUTATION = gql`
  ${HABIT_FIELDS}
  mutation ResumeHabit($id: ID!) {
    resumeHabit(id: $id) {
      ...HabitFields
    }
  }
`;
