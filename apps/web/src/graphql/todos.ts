import { gql } from "@apollo/client";

const TASK_FIELDS = gql`
  fragment TaskFields on Task {
    id
    key
    number
    listId
    list {
      id
      name
      prefix
      isInbox
    }
    title
    notes
    status
    position
    plannedFor
    completedAt
    createdAt
  }
`;

const LIST_FIELDS = gql`
  fragment TodoListFields on TodoList {
    id
    name
    prefix
    nextNumber
    isInbox
    position
    openCount
    doneCount
  }
`;

export const TODO_LISTS_QUERY = gql`
  ${LIST_FIELDS}
  query TodoLists {
    todoLists {
      ...TodoListFields
    }
  }
`;

export const SUGGEST_PREFIX_QUERY = gql`
  query SuggestListPrefix($name: String!) {
    suggestListPrefix(name: $name)
  }
`;

export const TODAY_TASKS_QUERY = gql`
  ${TASK_FIELDS}
  query TodayTasks($today: String!) {
    todayTasks(today: $today) {
      today {
        ...TaskFields
      }
      earlier {
        ...TaskFields
      }
    }
  }
`;

/** A list's board: every open task and the latest `doneLimit` done ones. */
export const LIST_BOARD_QUERY = gql`
  ${TASK_FIELDS}
  ${LIST_FIELDS}
  query ListBoard($listId: ID!, $doneLimit: Int) {
    listBoard(listId: $listId, doneLimit: $doneLimit) {
      list {
        ...TodoListFields
      }
      tasks {
        ...TaskFields
      }
      doneTotal
    }
  }
`;

export const TASK_BY_KEY_QUERY = gql`
  ${TASK_FIELDS}
  query TaskByKey($key: String!) {
    taskByKey(key: $key) {
      ...TaskFields
    }
  }
`;

export const CREATE_TODO_LIST_MUTATION = gql`
  ${LIST_FIELDS}
  mutation CreateTodoList($input: CreateTodoListInput!) {
    createTodoList(input: $input) {
      ...TodoListFields
    }
  }
`;

export const UPDATE_TODO_LIST_MUTATION = gql`
  ${LIST_FIELDS}
  mutation UpdateTodoList($id: ID!, $input: UpdateTodoListInput!) {
    updateTodoList(id: $id, input: $input) {
      ...TodoListFields
    }
  }
`;

export const DELETE_TODO_LIST_MUTATION = gql`
  mutation DeleteTodoList($id: ID!) {
    deleteTodoList(id: $id)
  }
`;

export const CREATE_TASK_MUTATION = gql`
  ${TASK_FIELDS}
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      ...TaskFields
    }
  }
`;

export const UPDATE_TASK_MUTATION = gql`
  ${TASK_FIELDS}
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      ...TaskFields
    }
  }
`;

export const DELETE_TASK_MUTATION = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;

/**
 * Every view a task change can touch: keys and counts show on the lists
 * page, today's plan and the boards. Refetched by operation name.
 */
export const TODO_REFETCH = ["TodoLists", "TodayTasks", "ListBoard"];
