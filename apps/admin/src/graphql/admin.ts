import { gql } from "@apollo/client";

export const ADMIN_OVERVIEW_QUERY = gql`
  query AdminOverview {
    adminOverview {
      tables {
        area
        table
        rows
      }
      database {
        migrations
        latestMigration
        latestAppliedAt
      }
      server {
        nodeVersion
        uptimeSeconds
        startedAt
      }
    }
  }
`;

const ACCOUNT_FIELDS = gql`
  fragment AdminAccountFields on Account {
    id
    name
    type
    currency
    institution
    last4
    icon
    isDefault
    balanceMinor
    openingBalanceDate
    archivedAt
  }
`;

export const ADMIN_ACCOUNTS_QUERY = gql`
  ${ACCOUNT_FIELDS}
  query AdminAccounts {
    accounts {
      ...AdminAccountFields
    }
    archivedAccounts {
      ...AdminAccountFields
    }
  }
`;

export const ARCHIVE_ACCOUNT_MUTATION = gql`
  mutation AdminArchiveAccount($id: ID!) {
    archiveAccount(id: $id) {
      id
      archivedAt
    }
  }
`;

export const UNARCHIVE_ACCOUNT_MUTATION = gql`
  mutation AdminUnarchiveAccount($id: ID!) {
    unarchiveAccount(id: $id) {
      id
      archivedAt
    }
  }
`;

export const SET_DEFAULT_ACCOUNT_MUTATION = gql`
  mutation AdminSetDefaultAccount($id: ID!) {
    setDefaultAccount(id: $id) {
      id
      isDefault
    }
  }
`;
