import type { MenuTreeNode } from "@/stores/auth-store";

/**
 * Partitions the single permission-and-scope-filtered menu tree (from
 * GET /api/auth/me) into whichever of the 3 dashboard sections is currently
 * on screen (`/admin/**`, `/company-admin/**`, or everything else i.e.
 * `/dashboard/**`) - so each dashboard tree renders completely separate menu
 * lists instead of one side just seeing a superset of another's items. This
 * is presentation-only partitioning on top of the server's own permission +
 * scope filtering (buildEffectiveMenuTree); it never grants or hides
 * anything a user couldn't already see/reach.
 */
const ADMIN_ROUTE_PREFIX = "/admin";
const COMPANY_ADMIN_ROUTE_PREFIX = "/company-admin";

export type MenuSection = "admin" | "company-admin" | "dashboard";

function sectionOf(route: string): MenuSection {
  if (route === ADMIN_ROUTE_PREFIX || route.startsWith(`${ADMIN_ROUTE_PREFIX}/`)) return "admin";
  if (route === COMPANY_ADMIN_ROUTE_PREFIX || route.startsWith(`${COMPANY_ADMIN_ROUTE_PREFIX}/`)) return "company-admin";
  return "dashboard";
}

export function sectionForPathname(pathname: string): MenuSection {
  return sectionOf(pathname);
}

export function filterMenusForSection(nodes: MenuTreeNode[], wantSection: MenuSection): MenuTreeNode[] {
  return nodes.reduce<MenuTreeNode[]>((result, node) => {
    const children = filterMenusForSection(node.children, wantSection);

    if (node.route) {
      // A leaf (or a node with both a route and children) belongs to
      // whichever section its own route is in - a group header with no
      // route of its own belongs to whichever section its children are in.
      if (sectionOf(node.route) === wantSection) {
        result.push({ ...node, children });
      }
    } else if (children.length > 0) {
      result.push({ ...node, children });
    }

    return result;
  }, []);
}
