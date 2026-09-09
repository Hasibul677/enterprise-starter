import { describe, it, expect } from "vitest";
import { flattenMenuRoutes, findOwningRoute } from "@/lib/permissions/route-match";
import type { MenuTreeNode } from "@/stores/auth-store";

function node(partial: Partial<MenuTreeNode> & { _id: string; label: string }): MenuTreeNode {
  return { route: null, icon: null, children: [], ...partial };
}

describe("flattenMenuRoutes", () => {
  it("collects routes from every depth of the tree", () => {
    const tree: MenuTreeNode[] = [
      node({
        _id: "1",
        label: "User Management",
        children: [node({ _id: "2", label: "Users", route: "/admin/users" })],
      }),
      node({ _id: "3", label: "Roles", route: "/admin/roles" }),
    ];

    expect(flattenMenuRoutes(tree)).toEqual(["/admin/users", "/admin/roles"]);
  });

  it("skips group headers with no route of their own", () => {
    const tree: MenuTreeNode[] = [node({ _id: "1", label: "User Management", route: null, children: [] })];
    expect(flattenMenuRoutes(tree)).toEqual([]);
  });
});

describe("findOwningRoute", () => {
  const routes = ["/admin/users", "/admin/roles"];

  it("matches an exact route", () => {
    expect(findOwningRoute("/admin/users", routes)).toBe("/admin/users");
  });

  it("matches a nested sub-path via prefix", () => {
    expect(findOwningRoute("/admin/users/123/edit", routes)).toBe("/admin/users");
  });

  it("returns null when nothing matches", () => {
    expect(findOwningRoute("/admin/menus", routes)).toBeNull();
  });

  it("never matches a route that merely shares a string prefix without a path boundary", () => {
    expect(findOwningRoute("/admin/users-archive", routes)).toBeNull();
  });

  it("picks the longest matching route when routes overlap", () => {
    expect(findOwningRoute("/admin/users/123", ["/admin", "/admin/users"])).toBe("/admin/users");
  });
});
