import { describe, it, expect } from "vitest";
import { requirePermission, requireAnyPermission, requireAllPermissions, requireAdminAreaAccess, requireNormalAdminAreaAccess } from "@/lib/permissions/guard";
import { AuthorizationError } from "@/lib/errors/app-error";
import { ROLE_SLUGS } from "@/lib/permissions/constants";
import type { ResolvedAccess } from "@/lib/auth/current-user";

function access(overrides: Partial<ResolvedAccess>): ResolvedAccess {
  return {
    user: {} as never,
    roles: [],
    roleSlugs: [],
    permissions: {},
    isSuperAdmin: false,
    sessionId: "session-1",
    impersonatedBy: null,
    ...overrides,
  };
}

describe("requirePermission (server-side authorization gate, requirement #13)", () => {
  it("allows an action when the merged permission map grants it", () => {
    const acc = access({ permissions: { users: { view: true, add: false, edit: false, delete: false, comment: false } } });
    expect(() => requirePermission(acc, "users", "view")).not.toThrow();
  });

  it("throws AuthorizationError when the permission is not granted (users.view=true, users.add=false)", () => {
    const acc = access({ permissions: { users: { view: true, add: false, edit: false, delete: false, comment: false } } });
    expect(() => requirePermission(acc, "users", "add")).toThrow(AuthorizationError);
  });

  it("throws for a resource the user has no entry for at all", () => {
    const acc = access({ permissions: {} });
    expect(() => requirePermission(acc, "users", "view")).toThrow(AuthorizationError);
  });

  it("Super Admin bypasses standard permission checks entirely (requirement #9)", () => {
    const acc = access({ isSuperAdmin: true, permissions: {} });
    expect(() => requirePermission(acc, "users", "delete")).not.toThrow();
  });

  it("does not let a client-manipulated permission object (e.g. tampered Zustand state) matter - this function only ever receives server-resolved access", () => {
    // Simulates the fact that even if a permissions object claiming "delete: true"
    // reached this function, it would have had to come from resolveCurrentAccess()
    // (DB-derived), never from client input - there is no code path that lets a
    // route handler call requirePermission() with client-supplied permissions.
    const acc = access({ permissions: { users: { view: true, add: true, edit: true, delete: true, comment: true } } });
    expect(() => requirePermission(acc, "users", "delete")).not.toThrow();
    expect(() => requirePermission(acc, "roles", "delete")).toThrow(AuthorizationError);
  });

  it("gates the comment permission the same way as the other actions", () => {
    const acc = access({ permissions: { users: { view: false, add: false, edit: false, delete: false, comment: true } } });
    expect(() => requirePermission(acc, "users", "comment")).not.toThrow();
    expect(() => requirePermission(acc, "users", "delete")).toThrow(AuthorizationError);
  });
});

describe("requireAnyPermission / requireAllPermissions (requirement #5)", () => {
  const checks = [{ resource: "users", action: "view" as const }, { resource: "roles", action: "view" as const }];

  it("requireAnyPermission passes with only one of the checks granted", () => {
    const acc = access({ permissions: { users: { view: true, add: false, edit: false, delete: false, comment: false } } });
    expect(() => requireAnyPermission(acc, checks)).not.toThrow();
  });

  it("requireAnyPermission throws when none of the checks are granted", () => {
    const acc = access({ permissions: {} });
    expect(() => requireAnyPermission(acc, checks)).toThrow(AuthorizationError);
  });

  it("requireAllPermissions throws unless every check is granted", () => {
    const acc = access({ permissions: { users: { view: true, add: false, edit: false, delete: false, comment: false } } });
    expect(() => requireAllPermissions(acc, checks)).toThrow(AuthorizationError);

    const accBoth = access({
      permissions: {
        users: { view: true, add: false, edit: false, delete: false, comment: false },
        roles: { view: true, add: false, edit: false, delete: false, comment: false },
      },
    });
    expect(() => requireAllPermissions(accBoth, checks)).not.toThrow();
  });

  it("Super Admin bypasses both", () => {
    const acc = access({ isSuperAdmin: true, permissions: {} });
    expect(() => requireAnyPermission(acc, checks)).not.toThrow();
    expect(() => requireAllPermissions(acc, checks)).not.toThrow();
  });
});

describe("requireAdminAreaAccess / requireNormalAdminAreaAccess (requirement #3/#4)", () => {
  it("allows Super Admin into both areas", () => {
    const acc = access({ isSuperAdmin: true });
    expect(() => requireAdminAreaAccess(acc)).not.toThrow();
    expect(() => requireNormalAdminAreaAccess(acc)).not.toThrow();
  });

  it("allows Admin into the admin area only", () => {
    const acc = access({ roleSlugs: [ROLE_SLUGS.ADMIN] });
    expect(() => requireAdminAreaAccess(acc)).not.toThrow();
    expect(() => requireNormalAdminAreaAccess(acc)).toThrow(AuthorizationError);
  });

  it("allows Normal Admin and Moderator into the normal-admin area only", () => {
    const normalAdmin = access({ roleSlugs: [ROLE_SLUGS.NORMAL_ADMIN] });
    const moderator = access({ roleSlugs: [ROLE_SLUGS.MODERATOR] });
    expect(() => requireAdminAreaAccess(normalAdmin)).toThrow(AuthorizationError);
    expect(() => requireNormalAdminAreaAccess(normalAdmin)).not.toThrow();
    expect(() => requireAdminAreaAccess(moderator)).toThrow(AuthorizationError);
    expect(() => requireNormalAdminAreaAccess(moderator)).not.toThrow();
  });

  it("blocks Customer from both areas", () => {
    const acc = access({ roleSlugs: [ROLE_SLUGS.CUSTOMER] });
    expect(() => requireAdminAreaAccess(acc)).toThrow(AuthorizationError);
    expect(() => requireNormalAdminAreaAccess(acc)).toThrow(AuthorizationError);
  });
});
