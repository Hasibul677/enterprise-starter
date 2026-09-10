import { AuthorizationError } from "@/lib/errors/app-error";
import { hasPermission, hasAnyPermission, hasAllPermissions, type PermissionCheck } from "./merge";
import { isAdminAreaLayer, isCompanyAdminAreaLayer } from "./role-hierarchy";
import { CORE_RESOURCES, USER_LAYERS } from "./constants";
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
 * can perform any specific action in it. COMPANY_ADMIN/MODERATOR/CUSTOMER
 * never pass, no matter what permissions they hold (requirement #3).
 */
export function requireAdminAreaAccess(access: ResolvedAccess) {
  if (access.isSuperAdmin || isAdminAreaLayer(access.userLayer)) return;
  throw new AuthorizationError("This action requires access to the Super Admin / Admin area.");
}

/**
 * Gate for the shared COMPANY_ADMIN/MODERATOR dashboard tree
 * (`/company-admin/**`), completely separate from requireAdminAreaAccess()
 * (requirement #3/#4). Super Admin can still reach it (requirement #2 -
 * "can access ... Company Admin/Moderator management routes").
 */
export function requireCompanyAdminAreaAccess(access: ResolvedAccess) {
  if (access.isSuperAdmin || isCompanyAdminAreaLayer(access.userLayer)) return;
  throw new AuthorizationError("This action requires access to the Company Admin / Moderator area.");
}

/**
 * Gate for who may start an impersonation ("Login as user") session at all -
 * Super Admin (any applicable lower layer) or Company Admin (its own
 * Moderators only, per-target eligibility enforced separately by
 * getImpersonationIneligibleReason) are unconditionally allowed. An ADMIN is
 * allowed ONLY if its effective permissions explicitly grant `users.login_as`
 * ("Login as" is a capability of the Users resource, not a separate
 * "impersonation" resource - see PERMISSION_ACTIONS in constants.ts,
 * granted via a Role's permission matrix or a per-user override - never on
 * by default); per-target eligibility (CUSTOMER only) is still separately
 * enforced by getImpersonationIneligibleReason via
 * IMPERSONATION_TARGET_LAYERS_BY. Moderator and Customer can never
 * impersonate anyone, regardless of any permission they hold - this feature
 * is deliberately never extended to COMPANY_ADMIN/MODERATOR/CUSTOMER through
 * this permission (resourceOptionsForLayer() also keeps `login_as` off
 * their role-editing UI entirely).
 */
export function requireImpersonationActor(access: ResolvedAccess) {
  if (access.isSuperAdmin || access.userLayer === USER_LAYERS.COMPANY_ADMIN) return;
  if (access.userLayer === USER_LAYERS.ADMIN && hasPermission(access.permissions, CORE_RESOURCES.USERS, "login_as")) {
    return;
  }
  throw new AuthorizationError(
    "This action requires Super Admin or Company Admin access, or an explicit impersonation permission grant."
  );
}

/**
 * Used by the shared Users API, which legitimately serves both admin-area
 * actors (managing ADMIN/CUSTOMER accounts) and company-admin-area actors
 * (managing their own MODERATORs) - see user.service.ts for the
 * finer-grained per-user authority this does NOT express on its own.
 */
export function requireAnyAdminAreaAccess(access: ResolvedAccess) {
  if (access.isSuperAdmin || isAdminAreaLayer(access.userLayer) || isCompanyAdminAreaLayer(access.userLayer)) return;
  throw new AuthorizationError("This action requires administrative access.");
}
