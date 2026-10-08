import { gql } from "@apollo/client";

const ME_FIELDS = gql`
  fragment MeFields on Me {
    id
    email
    name
    role
    status
    abilities {
      write
      openAdmin
      manageUsers
      assignableRoles
    }
  }
`;

export const ME_QUERY = gql`
  ${ME_FIELDS}
  query Me {
    me {
      ...MeFields
    }
  }
`;

export const SIGN_IN_MUTATION = gql`
  ${ME_FIELDS}
  mutation SignIn($email: String!, $password: String!) {
    signIn(email: $email, password: $password) {
      ...MeFields
    }
  }
`;

export const SIGN_UP_MUTATION = gql`
  ${ME_FIELDS}
  mutation SignUp($input: SignUpInput!) {
    signUp(input: $input) {
      status
      me {
        ...MeFields
      }
    }
  }
`;

export const SIGN_OUT_MUTATION = gql`
  mutation SignOut {
    signOut
  }
`;

export const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`;
