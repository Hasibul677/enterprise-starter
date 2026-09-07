import { describe, it, expect } from "vitest";
import { buildEffectiveMenuTree } from "@/lib/menu/menu-service";
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
    const tree = buildEffectiveMenuTree(all, { users: { view: true, add: false, edit: false, delete: false } }, false);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("Users");
  });

  it("shows a parent when it has an accessible child, even without its own route", () => {
    const all = [
      menu({ _id: "parent", name: "User Management", level: 1, route: null }),
      menu({ _id: "child", name: "Users", level: 2, parentId: "parent", route: "/users", resourceKey: "users" }),
    ];
    const tree = buildEffectiveMenuTree(all, { users: { view: true, add: false, edit: false, delete: false } }, false);
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
    const tree = buildEffectiveMenuTree(all, { users: { view: true, add: false, edit: false, delete: false } }, false);
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
});
