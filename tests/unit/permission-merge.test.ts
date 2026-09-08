import { describe, it, expect } from "vitest";
import { mergeRolePermissions, hasPermission, hasAnyPermission, hasAllPermissions } from "@/lib/permissions/merge";

describe("multi-role permission merge (requirement #11)", () => {
  it("merges two active roles using UNION/OR logic", () => {
    const merged = mergeRolePermissions([
      { isActive: true, permissions: { users: { view: true, add: false, edit: false, delete: false, comment: false } } },
      { isActive: true, permissions: { users: { view: true, add: true, edit: true, delete: false, comment: false } } },
    ]);

    expect(merged.users).toEqual({ view: true, add: true, edit: true, delete: false, comment: false });
  });

  it("ignores permissions from inactive roles entirely", () => {
    const merged = mergeRolePermissions([
      { isActive: true, permissions: { users: { view: true, add: false, edit: false, delete: false, comment: false } } },
      { isActive: false, permissions: { users: { view: true, add: true, edit: true, delete: true, comment: true } } },
    ]);

    expect(merged.users).toEqual({ view: true, add: false, edit: false, delete: false, comment: false });
  });

  it("is order-independent (deterministic regardless of role array order)", () => {
    const roleA = {
      isActive: true,
      permissions: { users: { view: true, add: false, edit: false, delete: false, comment: false } },
    };
    const roleB = {
      isActive: true,
      permissions: { users: { view: false, add: true, edit: false, delete: false, comment: false } },
    };

    expect(mergeRolePermissions([roleA, roleB])).toEqual(mergeRolePermissions([roleB, roleA]));
  });

  it("merges permissions across multiple distinct resources independently", () => {
    const merged = mergeRolePermissions([
      { isActive: true, permissions: { users: { view: true, add: false, edit: false, delete: false, comment: false } } },
      { isActive: true, permissions: { roles: { view: true, add: true, edit: false, delete: false, comment: false } } },
    ]);

    expect(hasPermission(merged, "users", "view")).toBe(true);
    expect(hasPermission(merged, "users", "add")).toBe(false);
    expect(hasPermission(merged, "roles", "add")).toBe(true);
  });

  it("returns no permissions when given no active roles", () => {
    const merged = mergeRolePermissions([]);
    expect(hasPermission(merged, "users", "view")).toBe(false);
  });

  it("merges the comment permission using the same UNION/OR logic as the other actions", () => {
    const merged = mergeRolePermissions([
      { isActive: true, permissions: { users: { view: false, add: false, edit: false, delete: false, comment: true } } },
      { isActive: true, permissions: { users: { view: false, add: false, edit: false, delete: false, comment: false } } },
    ]);

    expect(hasPermission(merged, "users", "comment")).toBe(true);
  });

  it("unions a user's per-user permissionOverrides on top of their role permissions (requirement #9), the same way current-user.ts does", () => {
    const rolePermissions = { isActive: true, permissions: { settings: { view: false, add: false, edit: false, delete: false, comment: false } } };
    const userOverrides = { isActive: true, permissions: { settings: { view: true, add: false, edit: false, delete: false, comment: false } } };

    const merged = mergeRolePermissions([rolePermissions, userOverrides]);

    expect(hasPermission(merged, "settings", "view")).toBe(true);
  });
});

describe("hasAnyPermission / hasAllPermissions (requirement #5 reusable permission-checking system)", () => {
  const permissions = {
    users: { view: true, add: false, edit: false, delete: false, comment: false },
    roles: { view: false, add: false, edit: false, delete: false, comment: false },
  };

  it("hasAnyPermission is true if at least one check passes", () => {
    expect(hasAnyPermission(permissions, [{ resource: "roles", action: "view" }, { resource: "users", action: "view" }])).toBe(true);
  });

  it("hasAnyPermission is false if none of the checks pass", () => {
    expect(hasAnyPermission(permissions, [{ resource: "roles", action: "view" }, { resource: "roles", action: "edit" }])).toBe(false);
  });

  it("hasAllPermissions is true only if every check passes", () => {
    expect(hasAllPermissions(permissions, [{ resource: "users", action: "view" }])).toBe(true);
    expect(hasAllPermissions(permissions, [{ resource: "users", action: "view" }, { resource: "roles", action: "view" }])).toBe(false);
  });
});
