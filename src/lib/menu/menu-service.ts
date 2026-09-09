import { menuRepository } from "@/repositories/menu.repository";
import { MAX_MENU_DEPTH } from "@/models/menu.model";
import { ValidationError, NotFoundError } from "@/lib/errors/app-error";
import { hasPermission } from "@/lib/permissions/merge";
import { MENU_SCOPES, USER_LAYERS } from "@/lib/permissions/constants";
import { isAdminAreaLayer, isCompanyAdminAreaLayer } from "@/lib/permissions/role-hierarchy";
import type { PermissionMap, UserLayer } from "@/lib/permissions/constants";
import type { MenuDocument } from "@/models/menu.model";

export type MenuTreeNode = MenuDocument & { children: MenuTreeNode[] };

/**
 * Validates a menu mutation against the 3-level hierarchy rules
 * (requirement #14 / #62): no self-parenting, no circular parents, no
 * 4th-level nesting, parent must exist and be within range.
 */
export async function validateMenuHierarchy(params: {
  menuId?: string; // undefined when creating
  parentId?: string | null;
}): Promise<{ level: number }> {
  if (!params.parentId) {
    return { level: 1 };
  }

  if (params.menuId && params.parentId === params.menuId) {
    throw new ValidationError("A menu item cannot be its own parent.", [
      { field: "parentId", message: "Self-parenting is not allowed." },
    ]);
  }

  const parent = await menuRepository.findById(params.parentId);
  if (!parent) {
    throw new NotFoundError("Parent menu not found.");
  }

  const level = parent.level + 1;
  if (level > MAX_MENU_DEPTH) {
    throw new ValidationError("Maximum menu depth exceeded.", [
      { field: "parentId", message: `Menus cannot be nested deeper than ${MAX_MENU_DEPTH} levels.` },
    ]);
  }

  // Circular-reference guard: walk up from the proposed parent and make sure
  // we never encounter the menu being edited.
  if (params.menuId) {
    let cursor: string | null = String(parent._id);
    const visited = new Set<string>();
    while (cursor) {
      if (cursor === params.menuId) {
        throw new ValidationError("Circular menu hierarchy detected.", [
          { field: "parentId", message: "This would create a circular parent relationship." },
        ]);
      }
      if (visited.has(cursor)) break; // safety valve against corrupt data
      visited.add(cursor);
      const node = await menuRepository.findById(cursor);
      cursor = node?.parentId ? String(node.parentId) : null;
    }
  }

  return { level };
}

/**
 * Builds the tree of menus the current user is actually allowed to see:
 * - inactive/hidden menus are excluded - EXCEPT for Super Admin, who has a
 *   complete system-level override and always sees every menu regardless of
 *   `isActive`/`isVisible` (additional RBAC requirement #5/#6)
 * - a scoped menu (requirement #7) is only visible to a user whose role is
 *   in that scope's dashboard - Super Admin sees both scopes (requirement
 *   #2 "can access every menu ... regardless of normal permission
 *   restrictions"); scope-less menus (e.g. the customer "Dashboard" link)
 *   are unaffected by this filter
 * - a leaf menu requires `view` permission on its resourceKey (menus with no
 *   resourceKey are always visible, e.g. a plain "Dashboard" link)
 * - a parent with no visible/accessible descendants and no direct route is hidden
 * - sortOrder is respected at every level
 */
export function buildEffectiveMenuTree(
  allMenus: MenuDocument[],
  permissions: PermissionMap,
  isSuperAdmin: boolean,
  userLayer: UserLayer = USER_LAYERS.CUSTOMER
): MenuTreeNode[] {
  const canSeeScope = (m: MenuDocument) => {
    if (isSuperAdmin || !m.scope) return true;
    if (m.scope === MENU_SCOPES.SUPER_ADMIN_ADMIN) return isAdminAreaLayer(userLayer);
    if (m.scope === MENU_SCOPES.COMPANY_ADMIN_MODERATOR) return isCompanyAdminAreaLayer(userLayer);
    return true;
  };

  const active = allMenus.filter((m) => (isSuperAdmin || (m.isActive && m.isVisible)) && canSeeScope(m));

  const canSee = (m: MenuDocument) =>
    isSuperAdmin || !m.resourceKey || hasPermission(permissions, m.resourceKey, "view");

  const byParent = new Map<string, MenuDocument[]>();
  for (const m of active) {
    const key = m.parentId ? String(m.parentId) : "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(m);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

  function build(parentKey: string): MenuTreeNode[] {
    const siblings = byParent.get(parentKey) ?? [];
    const result: MenuTreeNode[] = [];
    for (const menu of siblings) {
      const children = build(String(menu._id));
      const directlyAccessible = canSee(menu) && Boolean(menu.route);
      if (directlyAccessible || children.length > 0) {
        // Null out `route` when the node survives only because a child is
        // still visible - its OWN page isn't actually reachable, so callers
        // (the sidebar's Link-vs-toggle-button choice, and the client-side
        // route-revalidation in use-permission-sync.ts) must never treat it
        // as a live route just because the raw Menu document had one.
        result.push({ ...menu, route: directlyAccessible ? menu.route : null, children } as MenuTreeNode);
      }
    }
    return result;
  }

  return build("root");
}
