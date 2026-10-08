import { gql } from "@apollo/client";

const NOTIFICATION_FIELDS = gql`
  fragment NotificationFields on Notification {
    id
    kind
    reason
    params
    link
    surfacedAt
    unread
    done
    saved
  }
`;

export const NOTIFICATIONS_QUERY = gql`
  ${NOTIFICATION_FIELDS}
  query Notifications(
    $view: NotificationView
    $reason: NotificationReason
    $first: Int
    $after: String
    $clock: NotificationClock
  ) {
    notifications(view: $view, reason: $reason, first: $first, after: $after, clock: $clock) {
      items {
        ...NotificationFields
      }
      nextCursor
    }
  }
`;

export const NOTIFICATION_COUNTS_QUERY = gql`
  query NotificationCounts($clock: NotificationClock) {
    notificationCounts(clock: $clock) {
      inbox
      unread
      task
      money
      habit
      achievement
    }
  }
`;

export const MARK_NOTIFICATIONS_MUTATION = gql`
  ${NOTIFICATION_FIELDS}
  mutation MarkNotifications($ids: [ID!]!, $read: Boolean, $done: Boolean, $saved: Boolean) {
    markNotifications(ids: $ids, read: $read, done: $done, saved: $saved) {
      ...NotificationFields
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ_MUTATION = gql`
  mutation MarkAllNotificationsRead($reason: NotificationReason) {
    markAllNotificationsRead(reason: $reason)
  }
`;

/** After marking: the lists move items between views, and the bell's count changes. */
export const NOTIFICATIONS_REFETCH = ["Notifications", "NotificationCounts"];
