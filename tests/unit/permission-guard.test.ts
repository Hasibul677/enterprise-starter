import { describe, it, expect } from "vitest";
import {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireAdminAreaAccess,
  requireCompanyAdminAreaAccess,
  requireImpersonationActor,
} from "@/lib/permissions/guard";
import { AuthorizationError } from "@/lib/errors/app-error";
import { CORE_RESOURCES, USER_LAYERS } from "@/lib/permissions/constants";
import type { ResolvedAccess } from "@/lib/auth/current-user";

function access(overrides: Partial<ResolvedAccess>): ResolvedAccess {
  return {
    user: {} as never,
    roles: [],
    roleSlugs: [],
    userLayer: USER_LAYERS.CUSTOMER,
    permissions: {},
    isSuperAdmin: false,
    sessionId: "session-1",
    impersonatedBy: null,
    ...overrides,
  };
}

describe("requirePermission (server-side authorization gate, requirement #13)", () => {
  it("allows an action when the merged permission map grants it", () => {
    const acc = access({
      permissions: { users: { view: true, add: false, edit: false, delete: false, comment: false, login_as: false } },
    });
    expect(() => requirePermission(acc, "users", "view")).not.toThrow();
  });

  it("throws AuthorizationError when the permission is not granted (users.view=true, users.add=false)", () => {
    const acc = access({
      permissions: { users: { view: true, add: false, edit: false, delete: false, comment: false, login_as: false } },
    });
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
    const acc = access({
      permissions: { users: { view: true, add: true, edit: true, delete: true, comment: true, login_as: false } },
    });
    expect(() => requirePermission(acc, "users", "delete")).not.toThrow();
    expect(() => requirePermission(acc, "roles", "delete")).toThrow(AuthorizationError);
  });

  it("gates the comment permission the same way as the other actions", () => {
    const acc = access({
      permissions: { users: { view: false, add: false, edit: false, delete: false, comment: true, login_as: false } },
    });
    expect(() => requirePermission(acc, "users", "comment")).not.toThrow();
    expect(() => requirePermission(acc, "users", "delete")).toThrow(AuthorizationError);
  });
});

describe("requireAnyPermission / requireAllPermissions (requirement #5)", () => {
  const checks = [
    { resource: "users", action: "view" as const },
    { resource: "roles", action: "view" as const },
  ];

  it("requireAnyPermission passes with only one of the checks granted", () => {
    const acc = access({
      permissions: { users: { view: true, add: false, edit: false, delete: false, comment: false, login_as: false } },
    });
    expect(() => requireAnyPermission(acc, checks)).not.toThrow();
  });

  it("requireAnyPermission throws when none of the checks are granted", () => {
    const acc = access({ permissions: {} });
    expect(() => requireAnyPermission(acc, checks)).toThrow(AuthorizationError);
  });

  it("requireAllPermissions throws unless every check is granted", () => {
    const acc = access({
      permissions: { users: { view: true, add: false, edit: false, delete: false, comment: false, login_as: false } },
    });
    expect(() => requireAllPermissions(acc, checks)).toThrow(AuthorizationError);

    const accBoth = access({
      permissions: {
        users: { view: true, add: false, edit: false, delete: false, comment: false, login_as: false },
        roles: { view: true, add: false, edit: false, delete: false, comment: false, login_as: false },
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

describe("requireAdminAreaAccess / requireCompanyAdminAreaAccess (requirement #3/#4)", () => {
  it("allows Super Admin into both areas", () => {
    const acc = access({ isSuperAdmin: true });
    expect(() => requireAdminAreaAccess(acc)).not.toThrow();
    expect(() => requireCompanyAdminAreaAccess(acc)).not.toThrow();
  });

  it("allows Admin into the admin area only", () => {
    const acc = access({ userLayer: USER_LAYERS.ADMIN });
    expect(() => requireAdminAreaAccess(acc)).not.toThrow();
    expect(() => requireCompanyAdminAreaAccess(acc)).toThrow(AuthorizationError);
  });

  it("allows Company Admin and Moderator into the company-admin area only", () => {
    const companyAdmin = access({ userLayer: USER_LAYERS.COMPANY_ADMIN });
    const moderator = access({ userLayer: USER_LAYERS.MODERATOR });
    expect(() => requireAdminAreaAccess(companyAdmin)).toThrow(AuthorizationError);
    expect(() => requireCompanyAdminAreaAccess(companyAdmin)).not.toThrow();
    expect(() => requireAdminAreaAccess(moderator)).toThrow(AuthorizationError);
    expect(() => requireCompanyAdminAreaAccess(moderator)).not.toThrow();
  });

  it("blocks Customer from both areas", () => {
    const acc = access({ userLayer: USER_LAYERS.CUSTOMER });
    expect(() => requireAdminAreaAccess(acc)).toThrow(AuthorizationError);
    expect(() => requireCompanyAdminAreaAccess(acc)).toThrow(AuthorizationError);
  });
});

describe("requireImpersonationActor (Super Admin / Company Admin unconditional, Admin permission-gated)", () => {
  it("allows Super Admin unconditionally, even with an empty permission map", () => {
    const acc = access({ isSuperAdmin: true, permissions: {} });
    expect(() => requireImpersonationActor(acc)).not.toThrow();
  });

  it("allows Company Admin unconditionally, even with an empty permission map", () => {
    const acc = access({ userLayer: USER_LAYERS.COMPANY_ADMIN, permissions: {} });
    expect(() => requireImpersonationActor(acc)).not.toThrow();
  });

  it("blocks Admin without the `users.login_as` permission", () => {
    const acc = access({ userLayer: USER_LAYERS.ADMIN, permissions: {} });
    expect(() => requireImpersonationActor(acc)).toThrow(AuthorizationError);
  });

  it("blocks Admin even with unrelated users actions granted (view/add/edit/delete, but not login_as)", () => {
    const acc = access({
      userLayer: USER_LAYERS.ADMIN,
      permissions: {
        [CORE_RESOURCES.USERS]: { view: true, add: true, edit: true, delete: true, comment: true, login_as: false },
      },
    });
    expect(() => requireImpersonationActor(acc)).toThrow(AuthorizationError);
  });

  it("allows Admin once explicitly granted `users.login_as` - 'Login as' is a capability of the Users resource, not a separate resource", () => {
    const acc = access({
      userLayer: USER_LAYERS.ADMIN,
      permissions: {
        [CORE_RESOURCES.USERS]: { view: false, add: false, edit: false, delete: false, comment: false, login_as: true },
      },
    });
    expect(() => requireImpersonationActor(acc)).not.toThrow();
  });

  it("blocks Moderator and Customer regardless of any permission they hold - this feature is never extended to them", () => {
    for (const userLayer of [USER_LAYERS.MODERATOR, USER_LAYERS.CUSTOMER]) {
      const acc = access({
        userLayer,
        permissions: {
          [CORE_RESOURCES.USERS]: {
            view: false,
            add: false,
            edit: false,
            delete: false,
            comment: false,
            login_as: true,
          },
        },
      });
      expect(() => requireImpersonationActor(acc)).toThrow(AuthorizationError);
    }
  });
});
