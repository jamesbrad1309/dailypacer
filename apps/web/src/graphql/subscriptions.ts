import { gql } from "@apollo/client";
import { CATEGORY_FIELDS, TRANSACTIONS_REFETCH } from "#graphql/finance";

const SUBSCRIPTION_FIELDS = gql`
  ${CATEGORY_FIELDS}
  fragment SubscriptionFields on Subscription {
    id
    name
    serviceKey
    domain
    logoUrl
    account {
      id
      name
      currency
    }
    category {
      ...CategoryFields
    }
    interval
    intervalCount
    firstChargeOn
    trialEndsOn
    endsOn
    pausedAt
    note
    status
    currency
    amountMinor
    nextChargeOn
    monthlyMinor
    yearlyMinor
    prices {
      amountMinor
      effectiveFrom
    }
  }
`;

const CHARGE_FIELDS = gql`
  fragment ChargeFields on SubscriptionCharge {
    id
    dueOn
    amountMinor
    currency
    status
    transactionId
    afterTrial
    subscription {
      id
      name
      logoUrl
      account {
        id
        name
      }
    }
  }
`;

export const SUBSCRIPTION_SERVICES_QUERY = gql`
  query SubscriptionServices($search: String) {
    subscriptionServices(search: $search) {
      key
      name
      domain
      logoUrl
    }
  }
`;

export const SUBSCRIPTIONS_QUERY = gql`
  ${SUBSCRIPTION_FIELDS}
  query Subscriptions($today: String!, $includeEnded: Boolean) {
    subscriptions(today: $today, includeEnded: $includeEnded) {
      ...SubscriptionFields
    }
  }
`;

export const SUBSCRIPTION_SUMMARY_QUERY = gql`
  query SubscriptionSummary($today: String!) {
    subscriptionSummary(today: $today) {
      currency
      unconverted
      activeCount
      monthlyMinor
      yearlyMinor
      next30DaysMinor
      pendingCount
    }
  }
`;

export const SUBSCRIPTION_CHARGES_QUERY = gql`
  ${CHARGE_FIELDS}
  query SubscriptionCharges($from: String!, $to: String!, $today: String!) {
    subscriptionCharges(from: $from, to: $to, today: $today) {
      ...ChargeFields
    }
  }
`;

export const PENDING_CHARGES_QUERY = gql`
  ${CHARGE_FIELDS}
  query PendingSubscriptionCharges($today: String!) {
    pendingSubscriptionCharges(today: $today) {
      ...ChargeFields
    }
  }
`;

/** Everything a subscription change can move: lists, totals, the calendar and the inbox. */
export const SUBSCRIPTIONS_REFETCH = [
  "Subscriptions",
  "SubscriptionSummary",
  "SubscriptionCharges",
  "PendingSubscriptionCharges",
  "ToReviewCount",
];

/** Confirming or undoing a charge also logs or removes a transaction. */
export const CHARGE_REFETCH = [...new Set([...SUBSCRIPTIONS_REFETCH, ...TRANSACTIONS_REFETCH])];

export const CREATE_SUBSCRIPTION_MUTATION = gql`
  ${SUBSCRIPTION_FIELDS}
  mutation CreateSubscription($input: CreateSubscriptionInput!, $today: String!) {
    createSubscription(input: $input, today: $today) {
      ...SubscriptionFields
    }
  }
`;

export const UPDATE_SUBSCRIPTION_MUTATION = gql`
  ${SUBSCRIPTION_FIELDS}
  mutation UpdateSubscription($id: ID!, $input: UpdateSubscriptionInput!, $today: String!) {
    updateSubscription(id: $id, input: $input, today: $today) {
      ...SubscriptionFields
    }
  }
`;

export const CHANGE_SUBSCRIPTION_PRICE_MUTATION = gql`
  ${SUBSCRIPTION_FIELDS}
  mutation ChangeSubscriptionPrice(
    $id: ID!
    $amountMinor: Int!
    $effectiveFrom: String!
    $today: String!
  ) {
    changeSubscriptionPrice(
      id: $id
      amountMinor: $amountMinor
      effectiveFrom: $effectiveFrom
      today: $today
    ) {
      ...SubscriptionFields
    }
  }
`;

export const PAUSE_SUBSCRIPTION_MUTATION = gql`
  ${SUBSCRIPTION_FIELDS}
  mutation PauseSubscription($id: ID!, $today: String!) {
    pauseSubscription(id: $id, today: $today) {
      ...SubscriptionFields
    }
  }
`;

export const RESUME_SUBSCRIPTION_MUTATION = gql`
  ${SUBSCRIPTION_FIELDS}
  mutation ResumeSubscription($id: ID!, $today: String!) {
    resumeSubscription(id: $id, today: $today) {
      ...SubscriptionFields
    }
  }
`;

export const CANCEL_SUBSCRIPTION_MUTATION = gql`
  ${SUBSCRIPTION_FIELDS}
  mutation CancelSubscription($id: ID!, $endsOn: String!, $today: String!) {
    cancelSubscription(id: $id, endsOn: $endsOn, today: $today) {
      ...SubscriptionFields
    }
  }
`;

export const REACTIVATE_SUBSCRIPTION_MUTATION = gql`
  ${SUBSCRIPTION_FIELDS}
  mutation ReactivateSubscription($id: ID!, $today: String!) {
    reactivateSubscription(id: $id, today: $today) {
      ...SubscriptionFields
    }
  }
`;

export const DELETE_SUBSCRIPTION_MUTATION = gql`
  mutation DeleteSubscription($id: ID!) {
    deleteSubscription(id: $id)
  }
`;

export const CONFIRM_CHARGE_MUTATION = gql`
  mutation ConfirmSubscriptionCharge(
    $subscriptionId: ID!
    $dueOn: String!
    $amountMinor: Int
    $date: String
  ) {
    confirmSubscriptionCharge(
      subscriptionId: $subscriptionId
      dueOn: $dueOn
      amountMinor: $amountMinor
      date: $date
    ) {
      id
    }
  }
`;

export const SKIP_CHARGE_MUTATION = gql`
  mutation SkipSubscriptionCharge($subscriptionId: ID!, $dueOn: String!) {
    skipSubscriptionCharge(subscriptionId: $subscriptionId, dueOn: $dueOn)
  }
`;

export const REOPEN_CHARGE_MUTATION = gql`
  mutation ReopenSubscriptionCharge($subscriptionId: ID!, $dueOn: String!) {
    reopenSubscriptionCharge(subscriptionId: $subscriptionId, dueOn: $dueOn)
  }
`;
