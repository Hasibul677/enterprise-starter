"use client";

import { useAuthStore } from "@/stores/auth-store";
import { hasPermission, hasAnyPermission, hasAllPermissions, type PermissionCheck } from "./merge";
import type { PermissionAction } from "./constants";

export function usePermission(resource: string, action: PermissionAction): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  return isSuperAdmin || hasPermission(permissions, resource, action);
}

/** Requirement #5 client-side counterpart to requireAnyPermission() - UX only, never a security boundary. */
export function useAnyPermission(checks: PermissionCheck[]): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  return isSuperAdmin || hasAnyPermission(permissions, checks);
}

/** Requirement #5 client-side counterpart to requireAllPermissions() - UX only, never a security boundary. */
export function useAllPermissions(checks: PermissionCheck[]): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  return isSuperAdmin || hasAllPermissions(permissions, checks);
}
