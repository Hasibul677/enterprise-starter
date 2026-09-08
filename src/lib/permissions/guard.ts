import { AuthorizationError } from "@/lib/errors/app-error";
import { hasPermission, hasAnyPermission, hasAllPermissions, type PermissionCheck } from "./merge";
import { isAdminAreaRole, isNormalAdminAreaRole } from "./role-hierarchy";
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

/** Requirement #5 - passes if the actor holds ANY one of the given resource/action pairs. */
export function requireAnyPermission(access: ResolvedAccess, checks: PermissionCheck[]) {
  if (access.isSuperAdmin) return;
  if (!hasAnyPermission(access.permissions, checks)) {
    throw new AuthorizationError("You do not have any of the required permissions for this action.");
  }
}

/** Requirement #5 - passes only if the actor holds EVERY one of the given resource/action pairs. */
export function requireAllPermissions(access: ResolvedAccess, checks: PermissionCheck[]) {
  if (access.isSuperAdmin) return;
  if (!hasAllPermissions(access.permissions, checks)) {
    throw new AuthorizationError("You do not have all of the required permissions for this action.");
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

/**
 * Gate for the shared SUPER_ADMIN/ADMIN dashboard tree (`/admin/**` and the
 * APIs it calls). SUPER_ADMIN always passes; ADMIN passes too, but every
 * individual action inside still goes through requirePermission() - this
 * only proves the actor belongs in this dashboard at all, never that they
 * can perform any specific action in it. NORMAL_ADMIN/MODERATOR/CUSTOMER
 * never pass, no matter what permissions they hold (requirement #3).
 */
export function requireAdminAreaAccess(access: ResolvedAccess) {
  if (access.isSuperAdmin || isAdminAreaRole(access.roleSlugs)) return;
  throw new AuthorizationError("This action requires access to the Super Admin / Admin area.");
}

/**
 * Gate for the shared NORMAL_ADMIN/MODERATOR dashboard tree
 * (`/normal-admin/**`), completely separate from requireAdminAreaAccess()
 * (requirement #3/#4). Super Admin can still reach it (requirement #2 -
 * "can access ... Normal Admin/Moderator management routes").
 */
export function requireNormalAdminAreaAccess(access: ResolvedAccess) {
  if (access.isSuperAdmin || isNormalAdminAreaRole(access.roleSlugs)) return;
  throw new AuthorizationError("This action requires access to the Normal Admin / Moderator area.");
}

/**
 * Used by the shared Users API, which legitimately serves both admin-area
 * actors (managing ADMIN/CUSTOMER accounts) and normal-admin-area actors
 * (managing their own MODERATORs) - see user.service.ts for the
 * finer-grained per-user authority this does NOT express on its own.
 */
export function requireAnyAdminAreaAccess(access: ResolvedAccess) {
  if (access.isSuperAdmin || isAdminAreaRole(access.roleSlugs) || isNormalAdminAreaRole(access.roleSlugs)) return;
  throw new AuthorizationError("This action requires administrative access.");
}
