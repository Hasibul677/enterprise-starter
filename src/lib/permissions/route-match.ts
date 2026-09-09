import type { MenuTreeNode } from "@/stores/auth-store";

/** Walks a menu tree collecting every node's own route (children included), ignoring group headers with no route of their own. */
export function flattenMenuRoutes(tree: MenuTreeNode[]): string[] {
  const routes: string[] = [];
  function walk(nodes: MenuTreeNode[]) {
    for (const node of nodes) {
      if (node.route) routes.push(node.route);
      if (node.children.length > 0) walk(node.children);
    }
  }
  walk(tree);
  return routes;
}

/**
 * Which menu route "owns" the given pathname - the longest route that is
 * either an exact match or a path-segment prefix of it (e.g. "/admin/users"
 * owns "/admin/users/123/edit"). Used by use-permission-sync.ts to decide
 * whether the page the user is currently on just lost its menu/permission
 * access, without needing a separate path-to-resource registry.
 */
export function findOwningRoute(pathname: string, routes: string[]): string | null {
  let best: string | null = null;
  for (const route of routes) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      if (!best || route.length > best.length) best = route;
    }
  }
  return best;
}
