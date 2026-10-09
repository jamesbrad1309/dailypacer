import { gql } from "@apollo/client";

const ME_FIELDS = gql`
  fragment AdminMeFields on Me {
    id
    email
    name
    role
    abilities {
      openAdmin
      manageUsers
      assignableRoles
    }
  }
`;

/** Named "Me", like the web app's, so the BFF's logs and the session link treat it the same. */
export const ME_QUERY = gql`
  ${ME_FIELDS}
  query Me {
    me {
      ...AdminMeFields
    }
  }
`;

export const SIGN_IN_MUTATION = gql`
  ${ME_FIELDS}
  mutation SignIn($email: String!, $password: String!) {
    signIn(email: $email, password: $password) {
      ...AdminMeFields
    }
  }
`;

export const SIGN_OUT_MUTATION = gql`
  mutation SignOut {
    signOut
  }
`;

const USER_FIELDS = gql`
  fragment AdminUserFields on User {
    id
    email
    name
    role
    status
    lastSignInAt
    createdAt
    isSelf
    permissions {
      update
      changeRole
      changeStatus
      resetPassword
    }
  }
`;

export const ADMIN_USERS_QUERY = gql`
  ${USER_FIELDS}
  query AdminUsers {
    users {
      ...AdminUserFields
    }
  }
`;

export const CREATE_USER_MUTATION = gql`
  ${USER_FIELDS}
  mutation AdminCreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      ...AdminUserFields
    }
  }
`;

export const UPDATE_USER_MUTATION = gql`
  ${USER_FIELDS}
  mutation AdminUpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      ...AdminUserFields
    }
  }
`;

export const RESET_PASSWORD_MUTATION = gql`
  mutation AdminResetPassword($id: ID!, $password: String!) {
    resetUserPassword(id: $id, password: $password)
  }
`;
