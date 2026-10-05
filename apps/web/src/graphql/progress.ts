import { gql } from "@apollo/client";

/** Habits week by week; the page asks for twice its period, to compare halves. */
export const HABIT_PROGRESS_QUERY = gql`
  query HabitProgress($weeks: Int!, $today: String!) {
    habitProgress(weeks: $weeks, today: $today) {
      weeks {
        weekStart
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
        perWeek
        perWeekDue
      }
      days {
        date
        done
        due
      }
    }
  }
`;

export const TASK_PROGRESS_QUERY = gql`
  query TaskProgress($weeks: Int!, $today: String!) {
    taskProgress(weeks: $weeks, today: $today) {
      weeks {
        weekStart
        completed
        onTime
        late
        noDueDate
      }
      overdueNow
    }
  }
`;
