import { AuthorizationError } from "@/lib/errors/app-error";
import { hasPermission } from "./merge";
import type { ResolvedAccess } from "@/lib/auth/current-user";
import type { PermissionAction } from "./constants";

/**
 * Server-side authorization gate. This is the ONLY thing that ever grants
 * access to a protected action - frontend PermissionGuard/<Can> components
 * are UX sugar only (requirement #47) and are never trusted here.
 */
export function requirePermission(access: ResolvedAccess, resource: string, action: PermissionAction) {
  if (access.isSuperAdmin) return; // Super Admin bypasses standard permission checks (requirement #9)
  if (!hasPermission(access.permissions, resource, action)) {
    throw new AuthorizationError(`You do not have '${action}' permission on '${resource}'.`);
  }
}

/**
 * Hard role gate for routes/actions reserved exclusively for Super Admin -
 * distinct from requirePermission(), which a future non-super-admin role
 * could satisfy via an explicit permission grant. Use this where "Normal
 * User" must never get in, no matter what permissions a role is later given.
 */
export function requireSuperAdmin(access: ResolvedAccess) {
  if (!access.isSuperAdmin) {
    throw new AuthorizationError("This action requires Super Admin access.");
  }
}
