import {
  EMPTY_RESOURCE_PERMISSIONS,
  PERMISSION_ACTIONS,
  type PermissionMap,
  type ResourcePermissions,
} from "./constants";

/**
 * Multi-role permission merge algorithm.
 *
 * Rules (see requirement #11):
 * - A user may hold multiple roles.
 * - Permissions merge with UNION/OR logic: any granted permission from any
 *   ACTIVE role becomes granted for the user.
 * - Inactive roles contribute nothing.
 * - No deny-permissions: this keeps the algorithm simple, deterministic,
 *   and order-independent (idempotent regardless of role array order).
 */
export type RolePermissionSource = {
  isActive: boolean;
  permissions: PermissionMap;
};

export function mergeRolePermissions(roles: RolePermissionSource[]): PermissionMap {
  const merged: PermissionMap = {};

  for (const role of roles) {
    if (!role.isActive) continue;

    for (const [resource, actions] of Object.entries(role.permissions)) {
      if (!merged[resource]) {
        merged[resource] = { ...EMPTY_RESOURCE_PERMISSIONS };
      }
      for (const action of PERMISSION_ACTIONS) {
        if (actions[action]) {
          merged[resource][action] = true;
        }
      }
    }
  }

  return merged;
}

export function hasPermission(
  permissions: PermissionMap,
  resource: string,
  action: keyof ResourcePermissions
): boolean {
  return Boolean(permissions[resource]?.[action]);
}

/** A single `resource`/`action` pair to check with hasAnyPermission()/hasAllPermissions(). */
export type PermissionCheck = { resource: string; action: keyof ResourcePermissions };

/**
 * Requirement #5's reusable permission-checking system, alongside
 * hasPermission() above - OR semantics across multiple resource/action
 * pairs, for the (currently rare, but real) case where a page or action
 * should unlock on ANY of several grants rather than exactly one. Prefer
 * this over hand-rolling `hasPermission(...) || hasPermission(...)` inline.
 */
export function hasAnyPermission(permissions: PermissionMap, checks: PermissionCheck[]): boolean {
  return checks.some((c) => hasPermission(permissions, c.resource, c.action));
}

/** AND semantics across multiple resource/action pairs - see hasAnyPermission(). */
export function hasAllPermissions(permissions: PermissionMap, checks: PermissionCheck[]): boolean {
  return checks.every((c) => hasPermission(permissions, c.resource, c.action));
}
