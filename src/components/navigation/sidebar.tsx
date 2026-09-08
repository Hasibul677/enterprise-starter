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
  // is on screen, so /admin, /normal-admin, and /dashboard sidebars never mix.
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
        "hidden shrink-0 border-r border-line bg-surface p-3 transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="mb-6 flex items-center justify-between gap-2 px-1">
        {!collapsed && (
          <span className="flex items-center gap-2 truncate text-sm font-semibold tracking-tight text-ink">
            <FiZap aria-hidden="true" size={16} className="shrink-0 text-accent" />
            <span className="truncate">Enterprise Starter</span>
          </span>
        )}
        <IconButton
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleCollapsed}
          className={collapsed ? "mx-auto" : "ml-auto"}
        >
          {collapsed ? (
            <FiChevronsRight aria-hidden="true" size={16} />
          ) : (
            <FiChevronsLeft aria-hidden="true" size={16} />
          )}
        </IconButton>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-visible">
        <SidebarMenuList nodes={sectionedMenus} depth={0} collapsed={collapsed} />
      </nav>
    </aside>
  );
}
