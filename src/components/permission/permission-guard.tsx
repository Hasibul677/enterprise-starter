"use client";

import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { hasPermission } from "@/lib/permissions/merge";
import type { PermissionAction } from "@/lib/permissions/constants";

export type PermissionGuardProps = {
  resource: string;
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * UX-only helper - hides an action the user can't perform, for a cleaner
 * interface. This is NEVER the security boundary: the corresponding API
 * route independently calls requirePermission() server-side regardless of
 * what this component renders (requirement #47).
 */
export function PermissionGuard({ resource, action, children, fallback = null }: PermissionGuardProps) {
  const permissions = useAuthStore((s) => s.permissions);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  if (isSuperAdmin || hasPermission(permissions, resource, action)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}

/** Shorter alias, same behavior. */
export const Can = PermissionGuard;
