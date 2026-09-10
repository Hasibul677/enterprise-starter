import { describe, it, expect } from "vitest";
import {
  canCreateUserInLayer,
  canManageLayer,
  canManageTargetUser,
  canViewLayer,
  canViewTargetUser,
  canGrantPermissionOverride,
  canManageRole,
  getImpersonationIneligibleReason,
} from "@/lib/permissions/role-hierarchy";
import { USER_LAYERS } from "@/lib/permissions/constants";

const { SUPER_ADMIN, ADMIN, COMPANY_ADMIN, MODERATOR, CUSTOMER } = USER_LAYERS;

describe("canCreateUserInLayer (requirement #8/#15 - who can create/assign which layer)", () => {
  it("Super Admin can create Admin and Company Admin", () => {
    expect(canCreateUserInLayer(SUPER_ADMIN, ADMIN)).toBe(true);
    expect(canCreateUserInLayer(SUPER_ADMIN, COMPANY_ADMIN)).toBe(true);
  });

  it("Admin cannot create another Admin", () => {
    expect(canCreateUserInLayer(ADMIN, ADMIN)).toBe(false);
  });

  it("Admin cannot create a Super Admin", () => {
    expect(canCreateUserInLayer(ADMIN, SUPER_ADMIN)).toBe(false);
  });

  it("Company Admin can create Moderator", () => {
    expect(canCreateUserInLayer(COMPANY_ADMIN, MODERATOR)).toBe(true);
  });

  it("Company Admin cannot create Admin", () => {
    expect(canCreateUserInLayer(COMPANY_ADMIN, ADMIN)).toBe(false);
  });

  it("Moderator cannot create any privileged user", () => {
    expect(canCreateUserInLayer(MODERATOR, ADMIN)).toBe(false);
    expect(canCreateUserInLayer(MODERATOR, COMPANY_ADMIN)).toBe(false);
    expect(canCreateUserInLayer(MODERATOR, MODERATOR)).toBe(false);
    expect(canCreateUserInLayer(MODERATOR, SUPER_ADMIN)).toBe(false);
  });

  it("public registration path (Customer) can never self-assign a privileged layer", () => {
    expect(canCreateUserInLayer(CUSTOMER, ADMIN)).toBe(false);
    expect(canCreateUserInLayer(CUSTOMER, CUSTOMER)).toBe(false);
  });

  it("Super Admin cannot create MODERATOR directly - that would orphan managedBy, which only a Company Admin can set", () => {
    expect(canCreateUserInLayer(SUPER_ADMIN, MODERATOR)).toBe(false);
  });

  it("Super Admin cannot create another SUPER_ADMIN through this generic path", () => {
    expect(canCreateUserInLayer(SUPER_ADMIN, SUPER_ADMIN)).toBe(false);
  });
});

describe("canManageTargetUser (requirement #3/#10 - view/edit/deactivate authority + ownership)", () => {
  it("Super Admin can manage anyone", () => {
    expect(
      canManageTargetUser({
        actorUserId: "super-1",
        actorLayer: SUPER_ADMIN,
        isSuperAdmin: true,
        targetUserId: "admin-1",
        targetLayer: ADMIN,
      })
    ).toBe(true);
  });

  it("Admin can manage a Customer", () => {
    expect(
      canManageTargetUser({
        actorUserId: "admin-1",
        actorLayer: ADMIN,
        isSuperAdmin: false,
        targetUserId: "customer-1",
        targetLayer: CUSTOMER,
      })
    ).toBe(true);
  });

  it("Admin cannot manage another Admin or a Super Admin", () => {
    expect(
      canManageTargetUser({
        actorUserId: "admin-1",
        actorLayer: ADMIN,
        isSuperAdmin: false,
        targetUserId: "admin-2",
        targetLayer: ADMIN,
      })
    ).toBe(false);
    expect(
      canManageTargetUser({
        actorUserId: "admin-1",
        actorLayer: ADMIN,
        isSuperAdmin: false,
        targetUserId: "super-1",
        targetLayer: SUPER_ADMIN,
      })
    ).toBe(false);
  });

  it("Company Admin can manage its OWN moderator", () => {
    expect(
      canManageTargetUser({
        actorUserId: "ca-1",
        actorLayer: COMPANY_ADMIN,
        isSuperAdmin: false,
        targetUserId: "mod-1",
        targetLayer: MODERATOR,
        targetManagedBy: "ca-1",
      })
    ).toBe(true);
  });

  it("Company Admin A cannot manage Company Admin B's moderator (ownership, requirement #10)", () => {
    expect(
      canManageTargetUser({
        actorUserId: "ca-A",
        actorLayer: COMPANY_ADMIN,
        isSuperAdmin: false,
        targetUserId: "mod-of-B",
        targetLayer: MODERATOR,
        targetManagedBy: "ca-B",
      })
    ).toBe(false);
  });

  it("no one can manage themselves through this path (self-escalation guard)", () => {
    expect(
      canManageTargetUser({
        actorUserId: "admin-1",
        actorLayer: ADMIN,
        isSuperAdmin: false,
        targetUserId: "admin-1",
        targetLayer: ADMIN,
      })
    ).toBe(false);
  });

  it("Moderator cannot manage anyone", () => {
    expect(
      canManageTargetUser({
        actorUserId: "mod-1",
        actorLayer: MODERATOR,
        isSuperAdmin: false,
        targetUserId: "customer-1",
        targetLayer: CUSTOMER,
      })
    ).toBe(false);
  });
});

describe("canViewLayer / canViewTargetUser (Company Admin read-only access to its CUSTOMER tab)", () => {
  it("Company Admin can VIEW Customer, but still cannot MANAGE Customer", () => {
    expect(canViewLayer(COMPANY_ADMIN, CUSTOMER)).toBe(true);
    expect(canManageLayer(COMPANY_ADMIN, CUSTOMER)).toBe(false);
  });

  it("canViewLayer is a superset of canManageLayer for every layer", () => {
    for (const actorLayer of [SUPER_ADMIN, ADMIN, COMPANY_ADMIN, MODERATOR, CUSTOMER]) {
      for (const targetLayer of [SUPER_ADMIN, ADMIN, COMPANY_ADMIN, MODERATOR, CUSTOMER]) {
        if (canManageLayer(actorLayer, targetLayer)) {
          expect(canViewLayer(actorLayer, targetLayer)).toBe(true);
        }
      }
    }
  });

  it("Company Admin can view any Customer account, with no ownership restriction (unlike Moderators)", () => {
    expect(
      canViewTargetUser({
        actorUserId: "ca-1",
        actorLayer: COMPANY_ADMIN,
        isSuperAdmin: false,
        targetUserId: "customer-1",
        targetLayer: CUSTOMER,
      })
    ).toBe(true);
  });

  it("Company Admin cannot MANAGE (edit/delete/role/permissions) a Customer even though it can view them", () => {
    expect(
      canManageTargetUser({
        actorUserId: "ca-1",
        actorLayer: COMPANY_ADMIN,
        isSuperAdmin: false,
        targetUserId: "customer-1",
        targetLayer: CUSTOMER,
      })
    ).toBe(false);
  });

  it("Company Admin viewing a Moderator still requires ownership, same as managing one", () => {
    expect(
      canViewTargetUser({
        actorUserId: "ca-A",
        actorLayer: COMPANY_ADMIN,
        isSuperAdmin: false,
        targetUserId: "mod-of-B",
        targetLayer: MODERATOR,
        targetManagedBy: "ca-B",
      })
    ).toBe(false);
  });

  it("Admin's view authority is unchanged (Customer only, same as manage)", () => {
    expect(canViewLayer(ADMIN, CUSTOMER)).toBe(true);
    expect(canViewLayer(ADMIN, ADMIN)).toBe(false);
    expect(canViewLayer(ADMIN, SUPER_ADMIN)).toBe(false);
  });

  it("no one can view themselves through this path, same self-escalation guard as canManageTargetUser", () => {
    expect(
      canViewTargetUser({
        actorUserId: "ca-1",
        actorLayer: COMPANY_ADMIN,
        isSuperAdmin: false,
        targetUserId: "ca-1",
        targetLayer: CUSTOMER,
      })
    ).toBe(false);
  });

  it("Super Admin can view anyone", () => {
    expect(
      canViewTargetUser({
        actorUserId: "super-1",
        actorLayer: SUPER_ADMIN,
        isSuperAdmin: true,
        targetUserId: "customer-1",
        targetLayer: CUSTOMER,
      })
    ).toBe(true);
  });
});

describe("canGrantPermissionOverride (requirement #9 - permission-assignment escalation guards)", () => {
  const fullPerms = { view: true, add: true, edit: true, delete: true, comment: true };
  const emptyPerms = { view: false, add: false, edit: false, delete: false, comment: false };

  it("Super Admin can grant an Admin any resource regardless of its own permission map", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "super-1",
        actorLayer: SUPER_ADMIN,
        actorEffectivePermissions: {},
        isSuperAdmin: true,
        targetUserId: "admin-1",
        targetLayer: ADMIN,
        resource: "settings",
        action: "view",
      })
    ).toBe(true);
  });

  it("Company Admin can grant its own Moderator a resource it already holds itself", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "ca-1",
        actorLayer: COMPANY_ADMIN,
        actorEffectivePermissions: { comments: fullPerms },
        isSuperAdmin: false,
        targetUserId: "mod-1",
        targetLayer: MODERATOR,
        targetManagedBy: "ca-1",
        resource: "comments",
        action: "edit",
      })
    ).toBe(true);
  });

  it("no lower-level user can grant authority it doesn't itself hold", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "ca-1",
        actorLayer: COMPANY_ADMIN,
        actorEffectivePermissions: { comments: emptyPerms },
        isSuperAdmin: false,
        targetUserId: "mod-1",
        targetLayer: MODERATOR,
        targetManagedBy: "ca-1",
        resource: "comments",
        action: "edit",
      })
    ).toBe(false);
  });

  it("Company Admin cannot grant a Super Admin/Admin-scoped resource (e.g. roles) to its Moderator", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "ca-1",
        actorLayer: COMPANY_ADMIN,
        actorEffectivePermissions: { roles: fullPerms },
        isSuperAdmin: false,
        targetUserId: "mod-1",
        targetLayer: MODERATOR,
        targetManagedBy: "ca-1",
        resource: "roles",
        action: "view",
      })
    ).toBe(false);
  });

  it("Company Admin A cannot grant permissions to Company Admin B's moderator (ownership)", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "ca-A",
        actorLayer: COMPANY_ADMIN,
        actorEffectivePermissions: { comments: fullPerms },
        isSuperAdmin: false,
        targetUserId: "mod-of-B",
        targetLayer: MODERATOR,
        targetManagedBy: "ca-B",
        resource: "comments",
        action: "edit",
      })
    ).toBe(false);
  });

  it("no user can grant a permission to themselves", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "admin-1",
        actorLayer: ADMIN,
        actorEffectivePermissions: { users: fullPerms },
        isSuperAdmin: false,
        targetUserId: "admin-1",
        targetLayer: ADMIN,
        resource: "users",
        action: "view",
      })
    ).toBe(false);
  });

  it("Admin cannot grant permissions at all - it holds no granter role for any target layer", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "admin-1",
        actorLayer: ADMIN,
        actorEffectivePermissions: { users: fullPerms },
        isSuperAdmin: false,
        targetUserId: "customer-1",
        targetLayer: CUSTOMER,
        resource: "users",
        action: "view",
      })
    ).toBe(false);
  });
});

describe("canManageRole (requirement #6/#14 - dynamic role ownership)", () => {
  it("Super Admin can manage any role", () => {
    expect(
      canManageRole({
        isSuperAdmin: true,
        actorUserId: "super-1",
        actorLayer: SUPER_ADMIN,
        role: { userLayer: ADMIN, managedBy: null },
      })
    ).toBe(true);
  });

  it("Company Admin can manage a MODERATOR-layer role it created itself", () => {
    expect(
      canManageRole({
        isSuperAdmin: false,
        actorUserId: "ca-1",
        actorLayer: COMPANY_ADMIN,
        role: { userLayer: MODERATOR, managedBy: "ca-1" },
      })
    ).toBe(true);
  });

  it("Company Admin cannot manage a peer's MODERATOR-layer role", () => {
    expect(
      canManageRole({
        isSuperAdmin: false,
        actorUserId: "ca-A",
        actorLayer: COMPANY_ADMIN,
        role: { userLayer: MODERATOR, managedBy: "ca-B" },
      })
    ).toBe(false);
  });

  it("Company Admin cannot manage the shared system default (managedBy: null)", () => {
    expect(
      canManageRole({
        isSuperAdmin: false,
        actorUserId: "ca-1",
        actorLayer: COMPANY_ADMIN,
        role: { userLayer: MODERATOR, managedBy: null },
      })
    ).toBe(false);
  });

  it("Company Admin cannot manage a role targeting a different layer even if it owns it", () => {
    expect(
      canManageRole({
        isSuperAdmin: false,
        actorUserId: "ca-1",
        actorLayer: COMPANY_ADMIN,
        role: { userLayer: ADMIN, managedBy: "ca-1" },
      })
    ).toBe(false);
  });

  it("Admin can never manage a role, regardless of ownership", () => {
    expect(
      canManageRole({
        isSuperAdmin: false,
        actorUserId: "admin-1",
        actorLayer: ADMIN,
        role: { userLayer: ADMIN, managedBy: null },
      })
    ).toBe(false);
  });
});

describe("getImpersonationIneligibleReason (requirement #21 - Super Admin 'Login as User', extended to Company Admin -> own Moderators)", () => {
  it("Super Admin: allows impersonating Admin, Company Admin, Moderator, and Customer", () => {
    for (const layer of [ADMIN, COMPANY_ADMIN, MODERATOR, CUSTOMER]) {
      expect(
        getImpersonationIneligibleReason({
          actorUserId: "super-1",
          actorLayer: SUPER_ADMIN,
          isSuperAdmin: true,
          targetUserId: "target-1",
          targetUserLayer: layer,
          targetStatus: "ACTIVE",
        })
      ).toBeNull();
    }
  });

  it("Super Admin: blocks impersonating another Super Admin by default", () => {
    expect(
      getImpersonationIneligibleReason({
        actorUserId: "super-1",
        actorLayer: SUPER_ADMIN,
        isSuperAdmin: true,
        targetUserId: "super-2",
        targetUserLayer: SUPER_ADMIN,
        targetStatus: "ACTIVE",
      })
    ).toMatch(/Super Admin/);
  });

  it("blocks self-impersonation", () => {
    expect(
      getImpersonationIneligibleReason({
        actorUserId: "super-1",
        actorLayer: SUPER_ADMIN,
        isSuperAdmin: true,
        targetUserId: "super-1",
        targetUserLayer: ADMIN,
        targetStatus: "ACTIVE",
      })
    ).toMatch(/own account/);
  });

  it("Super Admin: blocks impersonating a non-active account, exactly like a normal login would reject it", () => {
    for (const status of ["BLOCKED", "DISABLED"]) {
      expect(
        getImpersonationIneligibleReason({
          actorUserId: "super-1",
          actorLayer: SUPER_ADMIN,
          isSuperAdmin: true,
          targetUserId: "target-1",
          targetUserLayer: CUSTOMER,
          targetStatus: status,
        })
      ).toMatch(/active/);
    }
  });

  it("Company Admin can access its OWN moderator", () => {
    expect(
      getImpersonationIneligibleReason({
        actorUserId: "ca-1",
        actorLayer: COMPANY_ADMIN,
        isSuperAdmin: false,
        targetUserId: "mod-1",
        targetUserLayer: MODERATOR,
        targetStatus: "ACTIVE",
        targetManagedBy: "ca-1",
      })
    ).toBeNull();
  });

  it("Company Admin cannot access a moderator it doesn't manage", () => {
    expect(
      getImpersonationIneligibleReason({
        actorUserId: "ca-A",
        actorLayer: COMPANY_ADMIN,
        isSuperAdmin: false,
        targetUserId: "mod-of-B",
        targetUserLayer: MODERATOR,
        targetStatus: "ACTIVE",
        targetManagedBy: "ca-B",
      })
    ).toMatch(/only access moderators you manage/);
  });

  it("Company Admin can never access a Customer account", () => {
    expect(
      getImpersonationIneligibleReason({
        actorUserId: "ca-1",
        actorLayer: COMPANY_ADMIN,
        isSuperAdmin: false,
        targetUserId: "customer-1",
        targetUserLayer: CUSTOMER,
        targetStatus: "ACTIVE",
      })
    ).toMatch(/not authorized/);
  });

  it("Company Admin: blocks accessing a non-active moderator it manages", () => {
    expect(
      getImpersonationIneligibleReason({
        actorUserId: "ca-1",
        actorLayer: COMPANY_ADMIN,
        isSuperAdmin: false,
        targetUserId: "mod-1",
        targetUserLayer: MODERATOR,
        targetStatus: "DISABLED",
        targetManagedBy: "ca-1",
      })
    ).toMatch(/active/);
  });

  it("Admin, Moderator, and Customer can never impersonate anyone", () => {
    for (const actorLayer of [ADMIN, MODERATOR, CUSTOMER]) {
      expect(
        getImpersonationIneligibleReason({
          actorUserId: "actor-1",
          actorLayer,
          isSuperAdmin: false,
          targetUserId: "target-1",
          targetUserLayer: CUSTOMER,
          targetStatus: "ACTIVE",
        })
      ).toMatch(/not authorized/);
    }
  });
});
