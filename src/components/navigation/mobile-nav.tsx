"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { FiMenu, FiX } from "react-icons/fi";
import { IconButton } from "@/components/ui/icon-button";
import { useAuthStore } from "@/stores/auth-store";
import { SidebarMenuList } from "./sidebar-menu-item";
import { filterMenusForSection, sectionForPathname } from "./menu-section";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const menus = useAuthStore((s) => s.menus);
  const pathname = usePathname();
  const sectionedMenus = useMemo(
    () => filterMenusForSection(menus, sectionForPathname(pathname)),
    [menus, pathname]
  );

  return (
    <div className="md:hidden">
      <IconButton label="Open navigation" onClick={() => setOpen(true)}>
        <FiMenu aria-hidden="true" size={20} />
      </IconButton>
      {open && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex w-72 flex-col gap-2 bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Menu</span>
              <IconButton label="Close navigation" onClick={() => setOpen(false)}>
                <FiX aria-hidden="true" size={20} />
              </IconButton>
            </div>
            <nav className="flex flex-col gap-0.5 overflow-y-auto">
              <SidebarMenuList nodes={sectionedMenus} depth={0} collapsed={false} />
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
