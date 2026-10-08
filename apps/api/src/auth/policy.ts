/**
 * The access rules (ABAC): whether a subject may take an action, decided from
 * attributes of the subject (role, status), the resource (the user being
 * managed: their role, whether it's the subject themself) and the change
 * asked for (the new role or status). Pure, so the whole rulebook is tested
 * in one place (policy.test.ts). Everyone shares one dataset for now, so app
 * data has no owner attribute yet; see docs/backend/auth.md.
 */

export const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const STATUSES = ["ACTIVE", "PENDING", "DISABLED"] as const;
export type Status = (typeof STATUSES)[number];

/** Who's asking. */
export interface Subject {
  id: string;
  role: Role;
  status: Status;
}

/** A user being managed. */
export interface UserResource {
  id: string;
  role: Role;
}

export type Request =
  /** Read the app's data: habits, money, tasks, journal, notifications. */
  | { action: "app:read" }
  /** Change the app's data. */
  | { action: "app:write" }
  /** Open the admin dashboard and its endpoints. */
  | { action: "admin:open" }
  | { action: "users:list" }
  | { action: "users:create"; role: Role }
  /** Change a user's name. */
  | { action: "user:update"; target: UserResource }
  | { action: "user:change-role"; target: UserResource; role: Role }
  | { action: "user:change-status"; target: UserResource; status: Status }
  /** Set someone else's password (an admin reset). */
  | { action: "user:reset-password"; target: UserResource }
  /** Change your own password (knowing the current one). */
  | { action: "self:change-password" };

export type Action = Request["action"];

/** Why a request was refused, stable for clients to translate. */
export type DenialCode =
  | "ACCOUNT_INACTIVE"
  | "READ_ONLY"
  | "MANAGERS_ONLY"
  | "OWNER_ONLY"
  | "SELF_ACCESS";

export type Decision = { allowed: true } | { allowed: false; reason: string; code: DenialCode };

const ALLOW: Decision = { allowed: true };
const deny = (code: DenialCode, reason: string): Decision => ({ allowed: false, reason, code });

const MANAGERS: Role[] = ["OWNER", "ADMIN"];
const WRITERS: Role[] = ["OWNER", "ADMIN", "MEMBER"];

/** The roles a subject may give someone: owners any, admins only member and viewer. */
export function assignableRoles(subject: Subject): Role[] {
  if (subject.role === "OWNER") return [...ROLES];
  if (subject.role === "ADMIN") return ["MEMBER", "VIEWER"];
  return [];
}

/**
 * Whether `subject` manages `target`: never themself (so nobody can lock
 * themself out or promote themself), owners manage anyone else, admins
 * manage members and viewers.
 */
function manages(subject: Subject, target: UserResource): Decision {
  if (subject.id === target.id) return deny("SELF_ACCESS", "You can't change your own access.");
  if (subject.role === "OWNER") return ALLOW;
  if (subject.role === "ADMIN" && (target.role === "MEMBER" || target.role === "VIEWER")) {
    return ALLOW;
  }
  return deny("OWNER_ONLY", "Only an owner can manage owners and admins.");
}

export function decide(subject: Subject, request: Request): Decision {
  // A pending or disabled account can't do anything, whatever its role.
  if (subject.status !== "ACTIVE") return deny("ACCOUNT_INACTIVE", "Your account isn't active.");

  switch (request.action) {
    case "app:read":
    case "self:change-password":
      return ALLOW;
    case "app:write":
      return WRITERS.includes(subject.role)
        ? ALLOW
        : deny("READ_ONLY", "Viewers can look but not change anything.");
    case "admin:open":
    case "users:list":
      return MANAGERS.includes(subject.role)
        ? ALLOW
        : deny("MANAGERS_ONLY", "Only owners and admins can do that.");
    case "users:create":
      if (!MANAGERS.includes(subject.role))
        return deny("MANAGERS_ONLY", "Only owners and admins can add people.");
      return assignableRoles(subject).includes(request.role)
        ? ALLOW
        : deny("OWNER_ONLY", "Only an owner can make someone an owner or admin.");
    case "user:update":
    case "user:reset-password":
    case "user:change-status":
      return manages(subject, request.target);
    case "user:change-role": {
      const managed = manages(subject, request.target);
      if (!managed.allowed) return managed;
      return assignableRoles(subject).includes(request.role)
        ? ALLOW
        : deny("OWNER_ONLY", "Only an owner can make someone an owner or admin.");
    }
  }
}

/** What the subject may do to one user, for the admin's Users table. */
export function permissionsOn(subject: Subject, target: UserResource) {
  const allowed = (request: Request) => decide(subject, request).allowed;
  return {
    update: allowed({ action: "user:update", target }),
    changeRole: assignableRoles(subject).some((role) =>
      allowed({ action: "user:change-role", target, role }),
    ),
    changeStatus: allowed({ action: "user:change-status", target, status: "DISABLED" }),
    resetPassword: allowed({ action: "user:reset-password", target }),
  };
}

/** The coarse abilities clients use to show or hide things. */
export function abilitiesOf(subject: Subject) {
  const allowed = (request: Request) => decide(subject, request).allowed;
  return {
    write: allowed({ action: "app:write" }),
    openAdmin: allowed({ action: "admin:open" }),
    manageUsers: allowed({ action: "users:list" }),
    assignableRoles: subject.status === "ACTIVE" ? assignableRoles(subject) : [],
  };
}
