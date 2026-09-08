import { describe, it, expect } from "vitest";
import {
  canAssignRole,
  canManageTargetUser,
  canGrantPermissionOverride,
  getImpersonationIneligibleReason,
} from "@/lib/permissions/role-hierarchy";
import { ROLE_SLUGS } from "@/lib/permissions/constants";

const { SUPER_ADMIN, ADMIN, NORMAL_ADMIN, MODERATOR, CUSTOMER } = ROLE_SLUGS;

describe("canAssignRole (requirement #8/#15 - who can create/assign which role)", () => {
  it("Super Admin can create Admin and Normal Admin", () => {
    expect(canAssignRole([SUPER_ADMIN], ADMIN)).toBe(true);
    expect(canAssignRole([SUPER_ADMIN], NORMAL_ADMIN)).toBe(true);
  });

  it("Admin cannot create another Admin", () => {
    expect(canAssignRole([ADMIN], ADMIN)).toBe(false);
  });

  it("Admin cannot create a Super Admin", () => {
    expect(canAssignRole([ADMIN], SUPER_ADMIN)).toBe(false);
  });

  it("Normal Admin can create Moderator", () => {
    expect(canAssignRole([NORMAL_ADMIN], MODERATOR)).toBe(true);
  });

  it("Normal Admin cannot create Admin", () => {
    expect(canAssignRole([NORMAL_ADMIN], ADMIN)).toBe(false);
  });

  it("Moderator cannot create any privileged user", () => {
    expect(canAssignRole([MODERATOR], ADMIN)).toBe(false);
    expect(canAssignRole([MODERATOR], NORMAL_ADMIN)).toBe(false);
    expect(canAssignRole([MODERATOR], MODERATOR)).toBe(false);
    expect(canAssignRole([MODERATOR], SUPER_ADMIN)).toBe(false);
  });

  it("public registration path (Customer) can never self-assign a privileged role", () => {
    expect(canAssignRole([CUSTOMER], ADMIN)).toBe(false);
    expect(canAssignRole([CUSTOMER], CUSTOMER)).toBe(false);
  });

  it("Super Admin cannot assign MODERATOR directly - that would orphan managedBy, which only a Normal Admin can set", () => {
    expect(canAssignRole([SUPER_ADMIN], MODERATOR)).toBe(false);
  });

  it("Super Admin cannot assign another SUPER_ADMIN through this generic path", () => {
    expect(canAssignRole([SUPER_ADMIN], SUPER_ADMIN)).toBe(false);
  });
});

describe("canManageTargetUser (requirement #3/#10 - view/edit/deactivate authority + ownership)", () => {
  it("Super Admin can manage anyone", () => {
    expect(
      canManageTargetUser({
        actorUserId: "super-1",
        actorSlugs: [SUPER_ADMIN],
        isSuperAdmin: true,
        targetUserId: "admin-1",
        targetSlugs: [ADMIN],
      })
    ).toBe(true);
  });

  it("Admin can manage a Customer", () => {
    expect(
      canManageTargetUser({
        actorUserId: "admin-1",
        actorSlugs: [ADMIN],
        isSuperAdmin: false,
        targetUserId: "customer-1",
        targetSlugs: [CUSTOMER],
      })
    ).toBe(true);
  });

  it("Admin cannot manage another Admin or a Super Admin", () => {
    expect(
      canManageTargetUser({ actorUserId: "admin-1", actorSlugs: [ADMIN], isSuperAdmin: false, targetUserId: "admin-2", targetSlugs: [ADMIN] })
    ).toBe(false);
    expect(
      canManageTargetUser({
        actorUserId: "admin-1",
        actorSlugs: [ADMIN],
        isSuperAdmin: false,
        targetUserId: "super-1",
        targetSlugs: [SUPER_ADMIN],
      })
    ).toBe(false);
  });

  it("Normal Admin can manage its OWN moderator", () => {
    expect(
      canManageTargetUser({
        actorUserId: "na-1",
        actorSlugs: [NORMAL_ADMIN],
        isSuperAdmin: false,
        targetUserId: "mod-1",
        targetSlugs: [MODERATOR],
        targetManagedBy: "na-1",
      })
    ).toBe(true);
  });

  it("Normal Admin A cannot manage Normal Admin B's moderator (ownership, requirement #10)", () => {
    expect(
      canManageTargetUser({
        actorUserId: "na-A",
        actorSlugs: [NORMAL_ADMIN],
        isSuperAdmin: false,
        targetUserId: "mod-of-B",
        targetSlugs: [MODERATOR],
        targetManagedBy: "na-B",
      })
    ).toBe(false);
  });

  it("Admin cannot manage a multi-role target that ALSO holds Super Admin, even though it also holds Customer (multi-role escalation guard)", () => {
    expect(
      canManageTargetUser({
        actorUserId: "admin-1",
        actorSlugs: [ADMIN],
        isSuperAdmin: false,
        targetUserId: "multi-1",
        targetSlugs: [SUPER_ADMIN, CUSTOMER],
      })
    ).toBe(false);
  });

  it("no one can manage themselves through this path (self-escalation guard)", () => {
    expect(
      canManageTargetUser({ actorUserId: "admin-1", actorSlugs: [ADMIN], isSuperAdmin: false, targetUserId: "admin-1", targetSlugs: [ADMIN] })
    ).toBe(false);
  });

  it("Moderator cannot manage anyone", () => {
    expect(
      canManageTargetUser({
        actorUserId: "mod-1",
        actorSlugs: [MODERATOR],
        isSuperAdmin: false,
        targetUserId: "customer-1",
        targetSlugs: [CUSTOMER],
      })
    ).toBe(false);
  });
});

describe("canGrantPermissionOverride (requirement #9 - permission-assignment escalation guards)", () => {
  const fullPerms = { view: true, add: true, edit: true, delete: true, comment: true };
  const emptyPerms = { view: false, add: false, edit: false, delete: false, comment: false };

  it("Super Admin can grant an Admin any resource regardless of its own permission map", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "super-1",
        actorSlugs: [SUPER_ADMIN],
        actorEffectivePermissions: {},
        isSuperAdmin: true,
        targetUserId: "admin-1",
        targetSlugs: [ADMIN],
        resource: "settings",
        action: "view",
      })
    ).toBe(true);
  });

  it("Normal Admin can grant its own Moderator a resource it already holds itself", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "na-1",
        actorSlugs: [NORMAL_ADMIN],
        actorEffectivePermissions: { comments: fullPerms },
        isSuperAdmin: false,
        targetUserId: "mod-1",
        targetSlugs: [MODERATOR],
        targetManagedBy: "na-1",
        resource: "comments",
        action: "edit",
      })
    ).toBe(true);
  });

  it("no lower-level user can grant authority it doesn't itself hold", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "na-1",
        actorSlugs: [NORMAL_ADMIN],
        actorEffectivePermissions: { comments: emptyPerms },
        isSuperAdmin: false,
        targetUserId: "mod-1",
        targetSlugs: [MODERATOR],
        targetManagedBy: "na-1",
        resource: "comments",
        action: "edit",
      })
    ).toBe(false);
  });

  it("Normal Admin cannot grant a Super Admin/Admin-scoped resource (e.g. roles) to its Moderator", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "na-1",
        actorSlugs: [NORMAL_ADMIN],
        actorEffectivePermissions: { roles: fullPerms },
        isSuperAdmin: false,
        targetUserId: "mod-1",
        targetSlugs: [MODERATOR],
        targetManagedBy: "na-1",
        resource: "roles",
        action: "view",
      })
    ).toBe(false);
  });

  it("Normal Admin cannot grant permissions to a multi-role target that ALSO holds Admin, even though it also holds Moderator (multi-role escalation guard)", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "na-1",
        actorSlugs: [NORMAL_ADMIN],
        actorEffectivePermissions: { comments: fullPerms },
        isSuperAdmin: false,
        targetUserId: "multi-1",
        targetSlugs: [MODERATOR, ADMIN],
        targetManagedBy: "na-1",
        resource: "comments",
        action: "edit",
      })
    ).toBe(false);
  });

  it("Normal Admin A cannot grant permissions to Normal Admin B's moderator (ownership)", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "na-A",
        actorSlugs: [NORMAL_ADMIN],
        actorEffectivePermissions: { comments: fullPerms },
        isSuperAdmin: false,
        targetUserId: "mod-of-B",
        targetSlugs: [MODERATOR],
        targetManagedBy: "na-B",
        resource: "comments",
        action: "edit",
      })
    ).toBe(false);
  });

  it("no user can grant a permission to themselves", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "admin-1",
        actorSlugs: [ADMIN],
        actorEffectivePermissions: { users: fullPerms },
        isSuperAdmin: false,
        targetUserId: "admin-1",
        targetSlugs: [ADMIN],
        resource: "users",
        action: "view",
      })
    ).toBe(false);
  });

  it("Admin cannot grant permissions at all - it holds no granter role for any target", () => {
    expect(
      canGrantPermissionOverride({
        actorUserId: "admin-1",
        actorSlugs: [ADMIN],
        actorEffectivePermissions: { users: fullPerms },
        isSuperAdmin: false,
        targetUserId: "customer-1",
        targetSlugs: [CUSTOMER],
        resource: "users",
        action: "view",
      })
    ).toBe(false);
  });
});

describe("getImpersonationIneligibleReason (requirement #21 - Super Admin 'Login as User')", () => {
  it("allows impersonating Admin, Normal Admin, Moderator, and Customer", () => {
    for (const slug of [ADMIN, NORMAL_ADMIN, MODERATOR, CUSTOMER]) {
      expect(
        getImpersonationIneligibleReason({ actorUserId: "super-1", targetUserId: "target-1", targetSlugs: [slug], targetStatus: "ACTIVE" })
      ).toBeNull();
    }
  });

  it("blocks impersonating another Super Admin by default", () => {
    expect(
      getImpersonationIneligibleReason({
        actorUserId: "super-1",
        targetUserId: "super-2",
        targetSlugs: [SUPER_ADMIN],
        targetStatus: "ACTIVE",
      })
    ).toMatch(/Super Admin/);
  });

  it("blocks self-impersonation", () => {
    expect(
      getImpersonationIneligibleReason({ actorUserId: "super-1", targetUserId: "super-1", targetSlugs: [ADMIN], targetStatus: "ACTIVE" })
    ).toMatch(/own account/);
  });

  it("blocks impersonating a non-active account, exactly like a normal login would reject it", () => {
    for (const status of ["BLOCKED", "DISABLED"]) {
      expect(
        getImpersonationIneligibleReason({ actorUserId: "super-1", targetUserId: "target-1", targetSlugs: [CUSTOMER], targetStatus: status })
      ).toMatch(/active/);
    }
  });
});
