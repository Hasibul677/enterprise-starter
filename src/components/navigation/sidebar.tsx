"use client";

import { useAuthStore } from "@/stores/auth-store";
import { SidebarMenuItem } from "./sidebar-menu-item";

/**
 * Consumes the dynamic effective menu tree from GET /api/auth/me.
 * Never hardcodes the sidebar structure (requirement #46/#71) - adding a
 * new module's menu entries via the Menus admin UI is enough for it to
 * appear here, filtered per-user by the permission engine server-side.
 */
export function Sidebar() {
  const menus = useAuthStore((s) => s.menus);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-line bg-surface p-4 md:flex md:flex-col">
      <div className="mb-6 px-2 text-sm font-semibold tracking-tight text-ink">Enterprise Starter</div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {menus.map((node) => (
          <SidebarMenuItem key={node._id} node={node} />
        ))}
      </nav>
    </aside>
  );
}
