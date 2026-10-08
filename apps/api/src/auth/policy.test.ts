import { describe, expect, it } from "vitest";
import { abilitiesOf, decide, permissionsOn, type Role, type Subject } from "./policy";

const user = (
  role: Role,
  id = role.toLowerCase(),
  status: Subject["status"] = "ACTIVE",
): Subject => ({
  id,
  role,
  status,
});
const owner = user("OWNER");
const admin = user("ADMIN");
const member = user("MEMBER");
const viewer = user("VIEWER");

describe("decide: app data", () => {
  it("lets every active role read", () => {
    for (const subject of [owner, admin, member, viewer]) {
      expect(decide(subject, { action: "app:read" }).allowed).toBe(true);
    }
  });

  it("keeps viewers read-only", () => {
    expect(decide(member, { action: "app:write" }).allowed).toBe(true);
    expect(decide(viewer, { action: "app:write" })).toEqual({
      allowed: false,
      reason: "Viewers can look but not change anything.",
      code: "READ_ONLY",
    });
  });

  it("refuses everything to pending and disabled accounts, whatever the role", () => {
    for (const status of ["PENDING", "DISABLED"] as const) {
      const subject = user("OWNER", "o", status);
      expect(decide(subject, { action: "app:read" }).allowed).toBe(false);
      expect(decide(subject, { action: "self:change-password" }).allowed).toBe(false);
    }
  });
});

describe("decide: admin and users", () => {
  it("opens the admin to owners and admins only", () => {
    expect(decide(owner, { action: "admin:open" }).allowed).toBe(true);
    expect(decide(admin, { action: "admin:open" }).allowed).toBe(true);
    expect(decide(member, { action: "admin:open" }).allowed).toBe(false);
    expect(decide(viewer, { action: "users:list" }).allowed).toBe(false);
  });

  it("lets admins add members and viewers, owners anyone", () => {
    expect(decide(admin, { action: "users:create", role: "MEMBER" }).allowed).toBe(true);
    expect(decide(admin, { action: "users:create", role: "ADMIN" }).allowed).toBe(false);
    expect(decide(owner, { action: "users:create", role: "OWNER" }).allowed).toBe(true);
    expect(decide(member, { action: "users:create", role: "VIEWER" }).allowed).toBe(false);
  });

  it("lets admins manage members and viewers but not admins or owners", () => {
    const target = { id: "m2", role: "MEMBER" as const };
    expect(
      decide(admin, { action: "user:change-status", target, status: "DISABLED" }).allowed,
    ).toBe(true);
    expect(decide(admin, { action: "user:change-role", target, role: "VIEWER" }).allowed).toBe(
      true,
    );
    expect(decide(admin, { action: "user:change-role", target, role: "ADMIN" }).allowed).toBe(
      false,
    );
    const otherAdmin = { id: "a2", role: "ADMIN" as const };
    expect(decide(admin, { action: "user:reset-password", target: otherAdmin }).allowed).toBe(
      false,
    );
    expect(
      decide(owner, { action: "user:change-role", target: otherAdmin, role: "OWNER" }).allowed,
    ).toBe(true);
  });

  it("never lets anyone change their own access", () => {
    const self = { id: owner.id, role: owner.role };
    expect(decide(owner, { action: "user:change-role", target: self, role: "VIEWER" })).toEqual({
      allowed: false,
      reason: "You can't change your own access.",
      code: "SELF_ACCESS",
    });
    expect(
      decide(owner, { action: "user:change-status", target: self, status: "DISABLED" }).allowed,
    ).toBe(false);
    expect(decide(viewer, { action: "self:change-password" }).allowed).toBe(true);
    expect(decide(viewer, { action: "self:update" }).allowed).toBe(true);
    expect(decide(user("MEMBER", "m", "DISABLED"), { action: "self:update" }).allowed).toBe(false);
  });
});

describe("permissionsOn and abilitiesOf", () => {
  it("summarise what the subject may do to one user", () => {
    expect(permissionsOn(admin, { id: "v2", role: "VIEWER" })).toEqual({
      update: true,
      changeRole: true,
      changeStatus: true,
      resetPassword: true,
    });
    expect(permissionsOn(admin, { id: "o2", role: "OWNER" })).toEqual({
      update: false,
      changeRole: false,
      changeStatus: false,
      resetPassword: false,
    });
  });

  it("summarise what the subject may do at all", () => {
    expect(abilitiesOf(viewer)).toEqual({
      write: false,
      openAdmin: false,
      manageUsers: false,
      assignableRoles: [],
    });
    expect(abilitiesOf(admin).assignableRoles).toEqual(["MEMBER", "VIEWER"]);
    expect(abilitiesOf(user("OWNER", "x", "PENDING")).write).toBe(false);
  });
});
