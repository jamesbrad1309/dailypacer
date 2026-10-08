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

export const ADMIN_CATEGORIES_QUERY = gql`
  query AdminCategories {
    categories(includeArchived: true) {
      id
      name
      icon
      color
      kind
      isSystem
      aliases
      parentId
      archivedAt
      sortOrder
    }
  }
`;

export const SET_CATEGORY_ARCHIVED_MUTATION = gql`
  mutation AdminSetCategoryArchived($id: ID!, $archived: Boolean!) {
    updateCategory(id: $id, input: { archived: $archived }) {
      id
      archivedAt
    }
  }
`;

export const ADMIN_CURRENCIES_QUERY = gql`
  query AdminCurrencies {
    currencySettings {
      currencies {
        code
        isMain
        overrideToMain
        marketRateToMain
        rateToMain
        accountCount
      }
      rates {
        date
        source
        fetchedAt
        attribution {
          label
          url
        }
      }
    }
  }
`;

export const SET_MAIN_CURRENCY_MUTATION = gql`
  mutation AdminSetMainCurrency($code: String!) {
    setMainCurrency(code: $code)
  }
`;

export const SET_RATE_OVERRIDE_MUTATION = gql`
  mutation AdminSetRateOverride($code: String!, $rateToMain: Float) {
    setExchangeRateOverride(code: $code, rateToMain: $rateToMain)
  }
`;

export const REFRESH_RATES_MUTATION = gql`
  mutation AdminRefreshRates {
    refreshExchangeRates {
      date
      source
      currencies
    }
  }
`;

const HABIT_FIELDS = gql`
  fragment AdminHabitFields on Habit {
    id
    name
    icon
    color
    tags
    polarity
    paused
    archivedAt
    currentStreak
    totalCompletions
    createdAt
  }
`;

export const ADMIN_HABITS_QUERY = gql`
  ${HABIT_FIELDS}
  query AdminHabits {
    habits {
      ...AdminHabitFields
    }
    archivedHabits {
      ...AdminHabitFields
    }
  }
`;

export const ARCHIVE_HABIT_MUTATION = gql`
  mutation AdminArchiveHabit($id: ID!) {
    archiveHabit(id: $id) {
      id
      archivedAt
    }
  }
`;

export const UNARCHIVE_HABIT_MUTATION = gql`
  mutation AdminUnarchiveHabit($id: ID!) {
    unarchiveHabit(id: $id) {
      id
      archivedAt
    }
  }
`;

export const ADMIN_TODO_LISTS_QUERY = gql`
  query AdminTodoLists {
    todoLists {
      id
      name
      prefix
      isInbox
      openCount
      doneCount
      createdAt
    }
  }
`;

export const RENAME_TODO_LIST_MUTATION = gql`
  mutation AdminRenameTodoList($id: ID!, $name: String!) {
    updateTodoList(id: $id, input: { name: $name }) {
      id
      name
    }
  }
`;

export const DELETE_TODO_LIST_MUTATION = gql`
  mutation AdminDeleteTodoList($id: ID!) {
    deleteTodoList(id: $id)
  }
`;
