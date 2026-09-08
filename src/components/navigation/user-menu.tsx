"use client";

import { useState } from "react";
import { FiLogOut, FiChevronDown, FiShield, FiUser } from "react-icons/fi";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/lib/api-client/api-client";
import { useRouter } from "next/navigation";

export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (!user) return null;

  async function handleLogout() {
    try {
      await apiClient.post("/api/auth/logout");
    } finally {
      clearSession();
      router.push("/login");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink hover:bg-paper"
      >
        <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {user.firstName[0]}
          {user.lastName[0]}
          <span
            title={isSuperAdmin ? "Super Admin" : "User"}
            className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-surface bg-accent text-white"
          >
            {isSuperAdmin ? (
              <FiShield aria-hidden="true" size={8} />
            ) : (
              <FiUser aria-hidden="true" size={8} />
            )}
          </span>
        </span>
        <span className="hidden sm:inline">{user.firstName} {user.lastName}</span>
        <FiChevronDown aria-hidden="true" size={14} className="text-ink-soft" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-md border border-line bg-surface py-1 shadow-lg">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-paper"
          >
            <FiLogOut aria-hidden="true" size={16} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
