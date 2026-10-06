import { gql } from "@apollo/client";

const ACCOUNT_FIELDS = gql`
  fragment AccountFields on Account {
    id
    name
    type
    currency
    institution
    last4
    sortOrder
    isDefault
    openingBalanceDate
    lastReconciledAt
    balanceMinor
    balanceMainMinor
    creditLimitMinor
    statementDay
    paymentDueDay
    minPaymentMinor
    availableCreditMinor
    utilization
    nextDueDate
    currentStatementSpendMinor
    aprBps
    monthlyPaymentMinor
    loanStartDate
    termMonths
    estimatedPayoffMonth
    paymentCoversInterest
    dueDate
    archivedAt
  }
`;

/** Money setup: every account plus the net-worth header, in one round trip. */
export const ACCOUNTS_QUERY = gql`
  ${ACCOUNT_FIELDS}
  query Accounts {
    accounts {
      ...AccountFields
    }
    archivedAccounts {
      ...AccountFields
    }
    netWorth {
      currency
      unconverted
      netWorthMinor
      assetsMinor
      liabilitiesMinor
    }
  }
`;

/**
 * Balances, net worth and the default flag are derived server-side and one
 * write can change several accounts, so every account mutation refetches
 * the whole screen. It's one small query.
 */
export const ACCOUNTS_REFETCH = ["Accounts", "QuickLogContext"];

/**
 * A transaction changes balances (Accounts), the inbox count, the list and
 * quick log's ranking, so every transaction write refetches those. Only
 * active queries are refetched, so this is cheap on any one screen.
 */
export const TRANSACTIONS_REFETCH = [
  "Accounts",
  "Transactions",
  "ToReviewCount",
  "QuickLogContext",
  "TodayLogs",
  "SpendByCategory",
  "CashFlow",
  "Budget",
  "TopPayees",
  "NetWorthHistory",
  "SavingsGoals",
  // A transaction can be a subscription charge: deleting or confirming it changes those views.
  "SubscriptionCharges",
  "PendingSubscriptionCharges",
  "SubscriptionSummary",
  // Finance-linked habits (no-spend day, log today's spending) are ticked from transactions.
  "Habits",
  "HabitDetail",
  "DashboardStats",
  "HabitCalendar",
  // A habit's cost, and the LifeOS level's finance XP.
  "HabitSpend",
  "LifeLevel",
];

export const CREATE_ACCOUNT_MUTATION = gql`
  ${ACCOUNT_FIELDS}
  mutation CreateAccount($input: CreateAccountInput!) {
    createAccount(input: $input) {
      ...AccountFields
    }
  }
`;

export const UPDATE_ACCOUNT_MUTATION = gql`
  ${ACCOUNT_FIELDS}
  mutation UpdateAccount($id: ID!, $input: UpdateAccountInput!) {
    updateAccount(id: $id, input: $input) {
      ...AccountFields
    }
  }
`;

export const ARCHIVE_ACCOUNT_MUTATION = gql`
  mutation ArchiveAccount($id: ID!) {
    archiveAccount(id: $id) {
      id
    }
  }
`;

export const UNARCHIVE_ACCOUNT_MUTATION = gql`
  mutation UnarchiveAccount($id: ID!) {
    unarchiveAccount(id: $id) {
      id
    }
  }
`;

export const SET_DEFAULT_ACCOUNT_MUTATION = gql`
  mutation SetDefaultAccount($id: ID!) {
    setDefaultAccount(id: $id) {
      id
    }
  }
`;

export const REORDER_ACCOUNTS_MUTATION = gql`
  mutation ReorderAccounts($ids: [ID!]!) {
    reorderAccounts(ids: $ids) {
      id
      sortOrder
    }
  }
`;

export const RECONCILE_ACCOUNT_MUTATION = gql`
  ${ACCOUNT_FIELDS}
  mutation ReconcileAccount($id: ID!, $actualBalanceMinor: Int!, $date: String!) {
    reconcileAccount(id: $id, actualBalanceMinor: $actualBalanceMinor, date: $date) {
      ...AccountFields
    }
  }
`;

export const CATEGORY_FIELDS = gql`
  fragment CategoryFields on Category {
    id
    name
    icon
    color
    kind
    aliases
    key
    parentId
    archivedAt
    sortOrder
  }
`;

export const CATEGORIES_QUERY = gql`
  ${CATEGORY_FIELDS}
  query Categories {
    categories {
      ...CategoryFields
    }
  }
`;

const TRANSACTION_FIELDS = gql`
  ${CATEGORY_FIELDS}
  fragment TransactionFields on Transaction {
    id
    date
    amountMinor
    payee
    note
    tags
    source
    status
    isTransfer
    transferAccount {
      id
      name
      currency
    }
    createdAt
    account {
      id
      name
      currency
    }
    category {
      ...CategoryFields
    }
    splits {
      id
      amountMinor
      note
      category {
        ...CategoryFields
      }
    }
  }
`;

/** Paged: Apollo's field policy for `transactions` appends pages (lib/apollo-client.ts). */
export const TRANSACTIONS_QUERY = gql`
  ${TRANSACTION_FIELDS}
  query Transactions($filter: TransactionFilter, $first: Int, $after: String) {
    transactions(filter: $filter, first: $first, after: $after) {
      items {
        ...TransactionFields
      }
      nextCursor
    }
  }
`;

/** Today's entries under the quick-log sheet in catch-up mode. */
export const TODAY_LOGS_QUERY = gql`
  ${TRANSACTION_FIELDS}
  query TodayLogs($filter: TransactionFilter) {
    todayLogs: transactions(filter: $filter, first: 20) {
      items {
        ...TransactionFields
      }
    }
  }
`;

/** Uncategorised transactions plus subscription charges waiting to be confirmed. */
export const TO_REVIEW_COUNT_QUERY = gql`
  query ToReviewCount($today: String) {
    toReviewCount(today: $today)
  }
`;

export const CREATE_TRANSACTION_MUTATION = gql`
  ${TRANSACTION_FIELDS}
  mutation CreateTransaction($input: CreateTransactionInput!) {
    createTransaction(input: $input) {
      ...TransactionFields
    }
  }
`;

export const UPDATE_TRANSACTION_MUTATION = gql`
  ${TRANSACTION_FIELDS}
  mutation UpdateTransaction($id: ID!, $input: UpdateTransactionInput!) {
    updateTransaction(id: $id, input: $input) {
      ...TransactionFields
    }
  }
`;

export const DELETE_TRANSACTION_MUTATION = gql`
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(id: $id)
  }
`;

export const QUICK_LOG_CONTEXT_QUERY = gql`
  ${CATEGORY_FIELDS}
  query QuickLogContext($hour: Int!, $dayOfWeek: Int!, $utcOffsetMinutes: Int) {
    quickLogContext(hour: $hour, dayOfWeek: $dayOfWeek, utcOffsetMinutes: $utcOffsetMinutes) {
      defaultAccount {
        id
      }
      accounts {
        id
        name
        type
        currency
        last4
      }
      suggestedCategories {
        ...CategoryFields
      }
      presets {
        id
        label
        emoji
        amountMinor
        payee
        category {
          ...CategoryFields
        }
        account {
          id
        }
      }
      recentPayees {
        payee
        category {
          id
        }
      }
      toReviewCount
      lastAccountByCategory
    }
  }
`;

export const QUICK_LOG_MUTATION = gql`
  ${TRANSACTION_FIELDS}
  mutation QuickLog($input: QuickLogInput!) {
    quickLog(input: $input) {
      transaction {
        ...TransactionFields
      }
      suggestPreset
      presetKey
      budgetAlert {
        level
        spentMinor
        availableMinor
        currency
        category {
          ...CategoryFields
        }
      }
    }
  }
`;

export const CREATE_QUICK_PRESET_MUTATION = gql`
  mutation CreateQuickPreset($input: CreateQuickPresetInput!) {
    createQuickPreset(input: $input) {
      id
    }
  }
`;

export const DELETE_QUICK_PRESET_MUTATION = gql`
  mutation DeleteQuickPreset($id: ID!) {
    deleteQuickPreset(id: $id)
  }
`;

export const DISMISS_PRESET_SUGGESTION_MUTATION = gql`
  mutation DismissPresetSuggestion($categoryId: ID!, $key: String!) {
    dismissPresetSuggestion(categoryId: $categoryId, key: $key)
  }
`;

/** Read from the `monthly_totals` aggregate: a handful of rows per month. */
export const CASH_FLOW_QUERY = gql`
  query CashFlow($to: String!, $months: Int) {
    cashFlow(to: $to, months: $months) {
      currency
      unconverted
      months {
        month
        inMinor
        outMinor
        netMinor
      }
    }
  }
`;

export const SPEND_BY_CATEGORY_QUERY = gql`
  ${CATEGORY_FIELDS}
  query SpendByCategory($month: String!, $accountId: ID) {
    spendByCategory(month: $month, accountId: $accountId) {
      month
      currency
      unconverted
      spentMinor
      previousSpentMinor
      incomeMinor
      categories {
        category {
          ...CategoryFields
        }
        spentMinor
        previousSpentMinor
        transactionCount
      }
    }
  }
`;

export const BUDGET_QUERY = gql`
  ${CATEGORY_FIELDS}
  query Budget($month: String!, $today: String) {
    budget(month: $month, today: $today) {
      month
      currency
      unconverted
      monthProgress
      totals {
        availableMinor
        spentMinor
        remainingMinor
      }
      lines {
        category {
          ...CategoryFields
        }
        limitMinor
        carriedMinor
        availableMinor
        spentMinor
        remainingMinor
        rollover
        since
        pace
        alert
        averageSpentMinor
      }
      unbudgeted {
        category {
          ...CategoryFields
        }
        spentMinor
        averageSpentMinor
      }
    }
  }
`;

export const SET_BUDGET_MUTATION = gql`
  mutation SetBudget($input: SetBudgetInput!) {
    setBudget(input: $input)
  }
`;

export const REMOVE_BUDGET_MUTATION = gql`
  mutation RemoveBudget($categoryId: ID!, $month: String!) {
    removeBudget(categoryId: $categoryId, month: $month)
  }
`;

export const CURRENCY_SETTINGS_QUERY = gql`
  query CurrencySettings {
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

/** Changing currencies or rates changes every converted total. */
export const CURRENCIES_REFETCH = [
  "CurrencySettings",
  "Accounts",
  "SpendByCategory",
  "Budget",
  "QuickLogContext",
];

export const ADD_CURRENCY_MUTATION = gql`
  mutation AddCurrency($code: String!) {
    addCurrency(code: $code)
  }
`;

export const REMOVE_CURRENCY_MUTATION = gql`
  mutation RemoveCurrency($code: String!) {
    removeCurrency(code: $code)
  }
`;

export const SET_MAIN_CURRENCY_MUTATION = gql`
  mutation SetMainCurrency($code: String!) {
    setMainCurrency(code: $code)
  }
`;

export const SET_RATE_OVERRIDE_MUTATION = gql`
  mutation SetExchangeRateOverride($code: String!, $rateToMain: Float) {
    setExchangeRateOverride(code: $code, rateToMain: $rateToMain)
  }
`;

export const REFRESH_RATES_MUTATION = gql`
  mutation RefreshExchangeRates {
    refreshExchangeRates {
      date
      source
      currencies
    }
  }
`;

export const CREATE_TRANSFER_MUTATION = gql`
  ${TRANSACTION_FIELDS}
  mutation CreateTransfer($input: CreateTransferInput!) {
    createTransfer(input: $input) {
      ...TransactionFields
    }
  }
`;

export const PREVIEW_CSV_IMPORT_MUTATION = gql`
  ${CATEGORY_FIELDS}
  mutation PreviewCsvImport($uploadId: ID!, $accountId: ID!, $mapping: JSON!) {
    previewCsvImport(uploadId: $uploadId, accountId: $accountId, mapping: $mapping) {
      currency
      total
      new
      duplicates
      matched
      beforeOpening
      rows {
        line
        date
        amountMinor
        payee
        note
        status
        category {
          ...CategoryFields
        }
      }
      problems {
        line
        reason
        value
      }
    }
  }
`;

export const COMMIT_CSV_IMPORT_MUTATION = gql`
  mutation CommitCsvImport($uploadId: ID!, $accountId: ID!, $mapping: JSON!, $includeMatched: Boolean) {
    commitCsvImport(
      uploadId: $uploadId
      accountId: $accountId
      mapping: $mapping
      includeMatched: $includeMatched
    ) {
      imported
      duplicates
      matched
      beforeOpening
    }
  }
`;

export const DISCARD_CSV_IMPORT_MUTATION = gql`
  mutation DiscardCsvImport($uploadId: ID!) {
    discardCsvImport(uploadId: $uploadId)
  }
`;

// ─── Categories and payee rules ──────────────────────────────────────────────

/** Every category of the user's, archived ones too, for the Categories page. */
export const MANAGE_CATEGORIES_QUERY = gql`
  ${CATEGORY_FIELDS}
  query ManageCategories {
    categories(includeArchived: true) {
      ...CategoryFields
    }
  }
`;

export const CREATE_CATEGORY_MUTATION = gql`
  ${CATEGORY_FIELDS}
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      ...CategoryFields
    }
  }
`;

export const UPDATE_CATEGORY_MUTATION = gql`
  ${CATEGORY_FIELDS}
  mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
    updateCategory(id: $id, input: $input) {
      ...CategoryFields
    }
  }
`;

/** Category pickers and names across finance read these. */
export const CATEGORIES_REFETCH = [
  "Categories",
  "ManageCategories",
  "QuickLogContext",
  "PayeeRules",
  "Transactions",
  "SpendByCategory",
  "Budget",
];

export const PAYEE_RULES_QUERY = gql`
  ${CATEGORY_FIELDS}
  query PayeeRules {
    payeeRules {
      id
      pattern
      sortOrder
      category {
        ...CategoryFields
      }
    }
  }
`;

export const PAYEE_RULE_MATCH_COUNT_QUERY = gql`
  query PayeeRuleMatchCount($pattern: String!) {
    payeeRuleMatchCount(pattern: $pattern)
  }
`;

export const CREATE_PAYEE_RULE_MUTATION = gql`
  mutation CreatePayeeRule($input: PayeeRuleInput!) {
    createPayeeRule(input: $input) {
      id
    }
  }
`;

export const UPDATE_PAYEE_RULE_MUTATION = gql`
  mutation UpdatePayeeRule($id: ID!, $input: PayeeRuleInput!) {
    updatePayeeRule(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_PAYEE_RULE_MUTATION = gql`
  mutation DeletePayeeRule($id: ID!) {
    deletePayeeRule(id: $id)
  }
`;

export const APPLY_PAYEE_RULES_MUTATION = gql`
  mutation ApplyPayeeRules {
    applyPayeeRules
  }
`;

// ─── Splits ──────────────────────────────────────────────────────────────────

export const SET_TRANSACTION_SPLITS_MUTATION = gql`
  ${TRANSACTION_FIELDS}
  mutation SetTransactionSplits($id: ID!, $splits: [TransactionSplitInput!]!) {
    setTransactionSplits(id: $id, splits: $splits) {
      ...TransactionFields
    }
  }
`;

// ─── Reports: top payees, net worth over time ────────────────────────────────

export const TOP_PAYEES_QUERY = gql`
  query TopPayees($from: String!, $to: String!, $limit: Int) {
    topPayees(from: $from, to: $to, limit: $limit) {
      currency
      unconverted
      payees {
        payee
        spentMinor
        transactionCount
      }
    }
  }
`;

export const NET_WORTH_HISTORY_QUERY = gql`
  query NetWorthHistory($to: String!, $months: Int) {
    netWorthHistory(to: $to, months: $months) {
      currency
      unconverted
      months {
        month
        assetsMinor
        liabilitiesMinor
        netWorthMinor
      }
    }
  }
`;

// ─── Savings goals ───────────────────────────────────────────────────────────

const GOAL_FIELDS = gql`
  fragment SavingsGoalFields on SavingsGoal {
    id
    name
    emoji
    targetMinor
    currency
    deadline
    startDate
    archivedAt
    savedMinor
    remainingMinor
    progress
    achieved
    overdue
    requiredPerMonthMinor
    onTrack
    expectedMinor
    dailyHabitMinor
    habitId
    account {
      id
      name
      currency
    }
  }
`;

export const SAVINGS_GOALS_QUERY = gql`
  ${GOAL_FIELDS}
  query SavingsGoals($today: String!, $includeArchived: Boolean) {
    savingsGoals(today: $today, includeArchived: $includeArchived) {
      ...SavingsGoalFields
    }
  }
`;

export const CREATE_SAVINGS_GOAL_MUTATION = gql`
  ${GOAL_FIELDS}
  mutation CreateSavingsGoal($input: CreateSavingsGoalInput!, $today: String!) {
    createSavingsGoal(input: $input, today: $today) {
      ...SavingsGoalFields
    }
  }
`;

export const UPDATE_SAVINGS_GOAL_MUTATION = gql`
  ${GOAL_FIELDS}
  mutation UpdateSavingsGoal($id: ID!, $input: UpdateSavingsGoalInput!, $today: String!) {
    updateSavingsGoal(id: $id, input: $input, today: $today) {
      ...SavingsGoalFields
    }
  }
`;

export const CONTRIBUTE_TO_SAVINGS_GOAL_MUTATION = gql`
  ${GOAL_FIELDS}
  mutation ContributeToSavingsGoal($id: ID!, $amountMinor: Int!, $today: String!) {
    contributeToSavingsGoal(id: $id, amountMinor: $amountMinor, today: $today) {
      ...SavingsGoalFields
    }
  }
`;

export const DELETE_SAVINGS_GOAL_MUTATION = gql`
  mutation DeleteSavingsGoal($id: ID!) {
    deleteSavingsGoal(id: $id)
  }
`;
