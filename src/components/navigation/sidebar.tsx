"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { FiChevronsLeft, FiChevronsRight, FiZap } from "react-icons/fi";
import { useAuthStore } from "@/stores/auth-store";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";
import { SidebarMenuList } from "./sidebar-menu-item";
import { filterMenusForSection, sectionForPathname } from "./menu-section";

const COLLAPSE_STORAGE_KEY = "sidebar:collapsed";

/**
 * Consumes the dynamic effective menu tree from GET /api/auth/me.
 * Never hardcodes the sidebar structure (requirement #46/#71) - adding a
 * new module's menu entries via the Menus admin UI is enough for it to
 * appear here, filtered per-user by the permission engine server-side.
 *
 * The collapse toggle is purely a presentational preference (persisted in
 * localStorage for this browser only) - it never changes which menu items
 * are fetched or shown, only how much of each row's label is visible.
 */
export function Sidebar() {
  const menus = useAuthStore((s) => s.menus);
  const pathname = usePathname();
  // The API returns one permission-and-scope-filtered tree for the whole
  // account; which slice of it renders here depends on which dashboard tree
  // is on screen, so /admin, /company-admin, and /dashboard sidebars never mix.
  const sectionedMenus = useMemo(
    () => filterMenusForSection(menus, sectionForPathname(pathname)),
    [menus, pathname]
  );
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only API (localStorage) to hydrate a client preference, not a render-time state sync
      setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
    } catch {
      // localStorage can throw in locked-down browser contexts - default (expanded) is fine.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore - nothing to persist to, sidebar just won't remember the preference.
      }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r border-line bg-surface p-3 transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("mb-6 flex items-center gap-3 px-1", collapsed ? "justify-center" : "justify-between")}>
        {collapsed ? (
          // Collapsed: one badge at top doubles as the expand toggle - shows
          // the chevron directly (not the logo) so it reads as clickable at
          // a glance, no hover needed to discover it.
          <IconButton
            label="Expand sidebar"
            onClick={toggleCollapsed}
            className="bg-accent text-white hover:bg-accent hover:text-white"
          >
            <FiChevronsRight aria-hidden="true" size={16} />
          </IconButton>
        ) : (
          <>
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-white">
                <FiZap aria-hidden="true" size={16} />
              </span>
              <span className="truncate text-sm font-semibold tracking-tight text-ink">Enterprise Starter</span>
            </span>
            <IconButton label="Collapse sidebar" onClick={toggleCollapsed}>
              <FiChevronsLeft aria-hidden="true" size={16} />
            </IconButton>
          </>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-visible">
        <SidebarMenuList nodes={sectionedMenus} depth={0} collapsed={collapsed} />
      </nav>
    </aside>
  );
}
