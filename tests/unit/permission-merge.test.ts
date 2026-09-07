import { describe, it, expect } from "vitest";
import { mergeRolePermissions, hasPermission } from "@/lib/permissions/merge";

describe("multi-role permission merge (requirement #11)", () => {
  it("merges two active roles using UNION/OR logic", () => {
    const merged = mergeRolePermissions([
      { isActive: true, permissions: { users: { view: true, add: false, edit: false, delete: false } } },
      { isActive: true, permissions: { users: { view: true, add: true, edit: true, delete: false } } },
    ]);

    expect(merged.users).toEqual({ view: true, add: true, edit: true, delete: false });
  });

  it("ignores permissions from inactive roles entirely", () => {
    const merged = mergeRolePermissions([
      { isActive: true, permissions: { users: { view: true, add: false, edit: false, delete: false } } },
      { isActive: false, permissions: { users: { view: true, add: true, edit: true, delete: true } } },
    ]);

    expect(merged.users).toEqual({ view: true, add: false, edit: false, delete: false });
  });

  it("is order-independent (deterministic regardless of role array order)", () => {
    const roleA = { isActive: true, permissions: { users: { view: true, add: false, edit: false, delete: false } } };
    const roleB = { isActive: true, permissions: { users: { view: false, add: true, edit: false, delete: false } } };

    expect(mergeRolePermissions([roleA, roleB])).toEqual(mergeRolePermissions([roleB, roleA]));
  });

  it("merges permissions across multiple distinct resources independently", () => {
    const merged = mergeRolePermissions([
      { isActive: true, permissions: { users: { view: true, add: false, edit: false, delete: false } } },
      { isActive: true, permissions: { roles: { view: true, add: true, edit: false, delete: false } } },
    ]);

    expect(hasPermission(merged, "users", "view")).toBe(true);
    expect(hasPermission(merged, "users", "add")).toBe(false);
    expect(hasPermission(merged, "roles", "add")).toBe(true);
  });

  it("returns no permissions when given no active roles", () => {
    const merged = mergeRolePermissions([]);
    expect(hasPermission(merged, "users", "view")).toBe(false);
  });
});
