"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { useAuthStore } from "@/stores/auth-store";
import { SidebarMenuItem } from "./sidebar-menu-item";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const menus = useAuthStore((s) => s.menus);

  return (
    <div className="md:hidden">
      <IconButton label="Open navigation" onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" />
      </IconButton>
      {open && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex w-72 flex-col gap-2 bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Menu</span>
              <IconButton label="Close navigation" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </IconButton>
            </div>
            <nav className="flex flex-col gap-0.5 overflow-y-auto">
              {menus.map((node) => (
                <SidebarMenuItem key={node._id} node={node} />
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
