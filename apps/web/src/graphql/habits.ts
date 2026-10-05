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
    polarity
    endDate
    customFields {
      label
      value
    }
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
      status
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

// ─── Calendar, review, achievements, correlations ────────────────────────────

export const HABIT_CALENDAR_QUERY = gql`
  query HabitCalendar($from: String!, $to: String!, $today: String!) {
    habitCalendar(from: $from, to: $to, today: $today) {
      habitId
      days {
        date
        status
        value
      }
    }
  }
`;

export const WEEKLY_REVIEW_QUERY = gql`
  query WeeklyReview($weekStart: String!, $today: String!) {
    weeklyReview(weekStart: $weekStart, today: $today) {
      weekStart
      weekEnd
      complete
      totals {
        done
        due
        rate
      }
      previous {
        done
        due
        rate
      }
      habits {
        id
        name
        done
        due
        rate
        missed
        frozen
      }
      wins
      atRisk {
        id
        name
        currentStreak
      }
      bestDay {
        date
        done
      }
    }
  }
`;

export const ACHIEVEMENTS_QUERY = gql`
  query Achievements($today: String!) {
    achievements(today: $today) {
      key
      progress
      target
      unlocked
      achievedOn
    }
  }
`;

export const HABIT_CORRELATIONS_QUERY = gql`
  query HabitCorrelations($today: String!) {
    habitCorrelations(today: $today) {
      habitId
      otherId
      kind
      withValue
      withoutValue
      daysWith
      daysWithout
    }
  }
`;

// ─── Points, rewards, freezes, challenges ────────────────────────────────────

export const POINTS_WALLET_QUERY = gql`
  query PointsWallet($today: String!) {
    pointsWallet(today: $today) {
      earned
      spent
      balance
      freezeCost
      spends {
        id
        points
        kind
        label
        createdAt
      }
    }
  }
`;

export const REWARDS_QUERY = gql`
  query Rewards {
    rewards {
      id
      name
      emoji
      cost
      timesRedeemed
    }
  }
`;

export const CREATE_REWARD_MUTATION = gql`
  mutation CreateReward($input: RewardInput!) {
    createReward(input: $input) {
      id
    }
  }
`;

export const UPDATE_REWARD_MUTATION = gql`
  mutation UpdateReward($id: ID!, $input: RewardInput!) {
    updateReward(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_REWARD_MUTATION = gql`
  mutation DeleteReward($id: ID!) {
    deleteReward(id: $id)
  }
`;

export const REDEEM_REWARD_MUTATION = gql`
  mutation RedeemReward($id: ID!, $today: String!) {
    redeemReward(id: $id, today: $today) {
      id
      points
      label
    }
  }
`;

export const UNDO_POINTS_SPEND_MUTATION = gql`
  mutation UndoPointsSpend($id: ID!) {
    undoPointsSpend(id: $id)
  }
`;

export const FREEZE_HABIT_DAY_MUTATION = gql`
  mutation FreezeHabitDay($habitId: ID!, $date: String!, $today: String!) {
    freezeHabitDay(habitId: $habitId, date: $date, today: $today)
  }
`;

export const UNFREEZE_HABIT_DAY_MUTATION = gql`
  mutation UnfreezeHabitDay($habitId: ID!, $date: String!) {
    unfreezeHabitDay(habitId: $habitId, date: $date)
  }
`;

export const CHALLENGES_QUERY = gql`
  query Challenges($today: String!) {
    challenges(today: $today) {
      id
      habitId
      habitName
      startDate
      endDate
      target
      multiplier
      done
      status
      bonusPoints
    }
  }
`;

export const CREATE_CHALLENGE_MUTATION = gql`
  mutation CreateChallenge($habitId: ID!, $input: ChallengeInput!, $today: String!) {
    createChallenge(habitId: $habitId, input: $input, today: $today) {
      id
    }
  }
`;

export const DELETE_CHALLENGE_MUTATION = gql`
  mutation DeleteChallenge($id: ID!) {
    deleteChallenge(id: $id)
  }
`;

// ─── Routines ────────────────────────────────────────────────────────────────

const ROUTINE_FIELDS = gql`
  fragment RoutineFields on Routine {
    id
    name
    icon
    startTime
    position
    habitIds
  }
`;

export const ROUTINES_QUERY = gql`
  ${ROUTINE_FIELDS}
  query Routines {
    routines {
      ...RoutineFields
    }
  }
`;

export const CREATE_ROUTINE_MUTATION = gql`
  ${ROUTINE_FIELDS}
  mutation CreateRoutine($input: RoutineInput!) {
    createRoutine(input: $input) {
      ...RoutineFields
    }
  }
`;

export const UPDATE_ROUTINE_MUTATION = gql`
  ${ROUTINE_FIELDS}
  mutation UpdateRoutine($id: ID!, $input: UpdateRoutineInput!) {
    updateRoutine(id: $id, input: $input) {
      ...RoutineFields
    }
  }
`;

export const DELETE_ROUTINE_MUTATION = gql`
  mutation DeleteRoutine($id: ID!) {
    deleteRoutine(id: $id)
  }
`;

/**
 * Everything a check-in can change: points and streaks (dashboard, wallet,
 * achievements), challenges, the calendar and the review. Refetched by
 * name, so only the queries on screen run again.
 */
export const HABIT_PROGRESS_REFETCH = [
  "DashboardStats",
  "HabitRecords",
  "PointsWallet",
  "Achievements",
  "Challenges",
  "HabitCalendar",
  "WeeklyReview",
];
