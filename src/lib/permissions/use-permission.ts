"use client";

import { useAuthStore } from "@/stores/auth-store";
import { hasPermission } from "./merge";
import type { PermissionAction } from "./constants";

export function usePermission(resource: string, action: PermissionAction): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  return isSuperAdmin || hasPermission(permissions, resource, action);
}
