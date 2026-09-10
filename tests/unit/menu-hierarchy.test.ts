import { describe, it, expect } from "vitest";
import { buildEffectiveMenuTree } from "@/lib/menu/menu-service";
import { MENU_SCOPES, USER_LAYERS } from "@/lib/permissions/constants";
import type { MenuDocument } from "@/models/menu.model";

// Minimal mock-menu builder for these tests only - intentionally loosely
// typed (input shape mirrors MenuDocument fields) and cast at the return.
function menu(overrides: Record<string, unknown> & { _id: string }): MenuDocument {
  return {
    name: "Item",
    label: "Item",
    slug: "item",
    route: null,
    icon: null,
    parentId: null,
    level: 1,
    sortOrder: 0,
    isActive: true,
    isVisible: true,
    resourceKey: null,
    scope: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  } as unknown as MenuDocument;
}

describe("effective menu tree (requirement #15)", () => {
  it("hides a leaf menu the user lacks view permission for", () => {
    const all = [menu({ _id: "1", name: "Users", route: "/users", resourceKey: "users", level: 1 })];
    const tree = buildEffectiveMenuTree(all, {}, false);
    expect(tree).toHaveLength(0);
  });

  it("shows a leaf menu when the user has view permission on its resourceKey", () => {
    const all = [menu({ _id: "1", name: "Users", route: "/users", resourceKey: "users", level: 1 })];
    const tree = buildEffectiveMenuTree(
      all,
      { users: { view: true, add: false, edit: false, delete: false, comment: false, login_as: false } },
      false
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("Users");
  });

  it("shows a parent when it has an accessible child, even without its own route", () => {
    const all = [
      menu({ _id: "parent", name: "User Management", level: 1, route: null }),
      menu({ _id: "child", name: "Users", level: 2, parentId: "parent", route: "/users", resourceKey: "users" }),
    ];
    const tree = buildEffectiveMenuTree(
      all,
      { users: { view: true, add: false, edit: false, delete: false, comment: false, login_as: false } },
      false
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("User Management");
    expect(tree[0].children).toHaveLength(1);
  });

  it("hides a parent with no accessible children and no direct route", () => {
    const all = [
      menu({ _id: "parent", name: "User Management", level: 1, route: null }),
      menu({ _id: "child", name: "Users", level: 2, parentId: "parent", route: "/users", resourceKey: "users" }),
    ];
    const tree = buildEffectiveMenuTree(all, {}, false); // no permissions at all
    expect(tree).toHaveLength(0);
  });

  it("excludes inactive menus even if the user has permission", () => {
    const all = [menu({ _id: "1", name: "Users", route: "/users", resourceKey: "users", isActive: false })];
    const tree = buildEffectiveMenuTree(
      all,
      { users: { view: true, add: false, edit: false, delete: false, comment: false, login_as: false } },
      false
    );
    expect(tree).toHaveLength(0);
  });

  it("Super Admin sees an inactive AND hidden menu regardless of isActive/isVisible (additional RBAC requirement #5/#6)", () => {
    const all = [
      menu({ _id: "1", name: "Users", route: "/users", resourceKey: "users", isActive: false, isVisible: false }),
    ];
    const tree = buildEffectiveMenuTree(all, {}, true);
    expect(tree).toHaveLength(1);
  });

  it("a non-Super-Admin still cannot see an inactive/hidden menu even with full permissions", () => {
    const all = [
      menu({ _id: "1", name: "Users", route: "/users", resourceKey: "users", isActive: false, isVisible: false }),
    ];
    const tree = buildEffectiveMenuTree(
      all,
      { users: { view: true, add: true, edit: true, delete: true, comment: true, login_as: false } },
      false,
      USER_LAYERS.ADMIN
    );
    expect(tree).toHaveLength(0);
  });

  it("super admin sees every active/visible menu regardless of permissions", () => {
    const all = [menu({ _id: "1", name: "Users", route: "/users", resourceKey: "users" })];
    const tree = buildEffectiveMenuTree(all, {}, true);
    expect(tree).toHaveLength(1);
  });

  it("respects sortOrder among siblings", () => {
    const all = [
      menu({ _id: "1", name: "B", route: "/b", sortOrder: 2 }),
      menu({ _id: "2", name: "A", route: "/a", sortOrder: 1 }),
    ];
    const tree = buildEffectiveMenuTree(all, {}, true);
    expect(tree.map((n) => n.name)).toEqual(["A", "B"]);
  });

  describe("menu scope (requirement #7)", () => {
    const fullPerms = { view: true, add: true, edit: true, delete: true, comment: true, login_as: false };
    const superAdminMenu = menu({
      _id: "1",
      name: "Roles",
      route: "/admin/roles",
      scope: MENU_SCOPES.SUPER_ADMIN_ADMIN,
    });
    const companyAdminMenu = menu({
      _id: "2",
      name: "Moderators",
      route: "/company-admin/users",
      resourceKey: "users",
      scope: MENU_SCOPES.COMPANY_ADMIN_MODERATOR,
    });

    it("hides a Super Admin/Admin-scoped menu from a Company Admin, even with a matching resourceKey permission", () => {
      const tree = buildEffectiveMenuTree([superAdminMenu], { roles: fullPerms }, false, USER_LAYERS.COMPANY_ADMIN);
      expect(tree).toHaveLength(0);
    });

    it("hides a Company Admin/Moderator-scoped menu from an Admin", () => {
      const tree = buildEffectiveMenuTree([companyAdminMenu], { users: fullPerms }, false, USER_LAYERS.ADMIN);
      expect(tree).toHaveLength(0);
    });

    it("shows a Super Admin/Admin-scoped menu to Admin, and a Company Admin/Moderator-scoped menu to Moderator", () => {
      expect(buildEffectiveMenuTree([superAdminMenu], { roles: fullPerms }, false, USER_LAYERS.ADMIN)).toHaveLength(1);
      expect(
        buildEffectiveMenuTree([companyAdminMenu], { users: fullPerms }, false, USER_LAYERS.MODERATOR)
      ).toHaveLength(1);
    });

    it("Super Admin sees both scopes regardless of userLayer (requirement #2)", () => {
      const tree = buildEffectiveMenuTree([superAdminMenu, companyAdminMenu], {}, true, USER_LAYERS.SUPER_ADMIN);
      expect(tree).toHaveLength(2);
    });

    it("a scope-less menu (e.g. the customer Dashboard link) is unaffected by scope filtering", () => {
      const dashboard = menu({ _id: "3", name: "Dashboard", route: "/dashboard", scope: null });
      const tree = buildEffectiveMenuTree([dashboard], {}, false, USER_LAYERS.CUSTOMER);
      expect(tree).toHaveLength(1);
    });
  });
});
