import { CombinedGraphQLErrors } from "@apollo/client/errors";
import type { auth } from "#i18n/en/auth";

type ReasonKey = Exclude<
  keyof typeof auth.errors,
  "emailInvalid" | "passwordTooShort" | "nameRequired" | "generic"
>;

const REASONS = new Set<string>([
  "WRONG_CREDENTIALS",
  "ACCOUNT_PENDING",
  "ACCOUNT_DISABLED",
  "TOO_MANY_ATTEMPTS",
  "EMAIL_TAKEN",
  "WRONG_PASSWORD",
  "READ_ONLY",
  "MANAGERS_ONLY",
  "OWNER_ONLY",
  "SELF_ACCESS",
  "ACCOUNT_INACTIVE",
  "SIGNED_OUT",
] satisfies ReasonKey[]);

/** The API's `reason` for an auth or access error, if it gave one this app translates. */
export function authReason(error: unknown): ReasonKey | null {
  if (!CombinedGraphQLErrors.is(error)) return null;
  for (const e of error.errors) {
    const reason = e.extensions?.reason;
    if (typeof reason === "string" && REASONS.has(reason)) return reason as ReasonKey;
  }
  return null;
}

/** The i18n key to show for a failed auth request: the translated reason, else "generic". */
export function authErrorKey(error: unknown): `auth.errors.${keyof typeof auth.errors}` {
  return `auth.errors.${authReason(error) ?? "generic"}`;
}
