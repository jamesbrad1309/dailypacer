import { gql } from "@apollo/client";

const HABIT_FIELDS = gql`
  fragment HabitFields on Habit {
    id
    name
    description
    tags
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
  mutation PauseHabit($id: ID!, $date: String) {
    pauseHabit(id: $id, date: $date) {
      ...HabitFields
    }
  }
`;

export const RESUME_HABIT_MUTATION = gql`
  ${HABIT_FIELDS}
  mutation ResumeHabit($id: ID!, $date: String) {
    resumeHabit(id: $id, date: $date) {
      ...HabitFields
    }
  }
`;

/** One habit, for its detail page; its records come a page at a time (HABIT_RECORDS_QUERY). */
export const HABIT_DETAIL_QUERY = gql`
  ${HABIT_FIELDS}
  query HabitDetail($id: ID!) {
    habit(id: $id) {
      ...HabitFields
      createdAt
    }
  }
`;

/** A page of a habit's check-ins and misses, paged and worked out on the server. */
export const HABIT_RECORDS_QUERY = gql`
  query HabitRecords(
    $habitId: ID!
    $today: String!
    $filter: HabitRecordFilter
    $page: Int
    $pageSize: Int
  ) {
    habitRecords(
      habitId: $habitId
      today: $today
      filter: $filter
      page: $page
      pageSize: $pageSize
    ) {
      total
      page
      pageSize
      trackedSince
      missesByWeek
      counts {
        all
        done
        notDone
        missed
      }
      items {
        date
        status
        entry {
          id
          value
          note
        }
        week {
          start
          end
          done
          target
        }
      }
    }
  }
`;

/** Completion by weekday and this month vs last, worked out on the server. */
export const HABIT_INSIGHTS_QUERY = gql`
  query HabitInsights($habitId: ID!, $today: String!) {
    habitInsights(habitId: $habitId, today: $today) {
      best
      worst
      weekdays {
        weekday
        due
        done
        rate
      }
      thisMonth {
        from
        to
        due
        done
        rate
      }
      lastMonth {
        from
        to
        due
        done
        rate
      }
    }
  }
`;
