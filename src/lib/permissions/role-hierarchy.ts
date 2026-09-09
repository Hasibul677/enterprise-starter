/**
 * The authority engine for the 5-layer user hierarchy:
 *
 *   SUPER_ADMIN
 *     |-- ADMIN
 *     `-- COMPANY_ADMIN
 *           `-- MODERATOR
 *   CUSTOMER (independent)
 *
 * Every function in this file takes a `UserLayer` scalar (User.userLayer),
 * NEVER a role slug/name - roles are dynamic, unlimited, permission-only
 * bundles that merely TARGET one of these 5 fixed layers (Role.userLayer).
 * Hierarchy/authority decisions must never branch on which specific role a
 * user holds; only on which layer they belong to. See constants.ts for why
 * USER_LAYERS and ROLE_SLUGS are deliberately separate concepts.
 *
 * This module is intentionally pure (no DB access) so it stays trivial to
 * unit test - see tests/unit/role-hierarchy.test.ts. Callers (services,
 * route handlers) own resolving DB documents into the plain layers/ids this
 * module works with.
 *
 * SUPER_ADMIN is handled by its own `isSuperAdmin` flag everywhere (as it
 * already was pre-hierarchy) and bypasses every check in this file - it is
 * still listed in the tables below for documentation/completeness.
 */
import { CORE_RESOURCES, USER_LAYERS, type PermissionMap, type PermissionAction, type UserLayer } from "./constants";
import { hasPermission } from "./merge";

/** Which layers a user belonging to `key` is allowed to CREATE a brand-new user in (requirement #8). */
export const CREATABLE_LAYERS_BY: Record<UserLayer, UserLayer[]> = {
  [USER_LAYERS.SUPER_ADMIN]: [USER_LAYERS.ADMIN, USER_LAYERS.COMPANY_ADMIN, USER_LAYERS.CUSTOMER],
  [USER_LAYERS.ADMIN]: [USER_LAYERS.CUSTOMER],
  [USER_LAYERS.COMPANY_ADMIN]: [USER_LAYERS.MODERATOR],
  [USER_LAYERS.MODERATOR]: [],
  [USER_LAYERS.CUSTOMER]: [],
};

/** Which layers a user belonging to `key` is allowed to VIEW/EDIT/DEACTIVATE an EXISTING user of (requirement #3/#10). */
export const MANAGEABLE_TARGET_LAYERS_BY: Record<UserLayer, UserLayer[]> = {
  [USER_LAYERS.SUPER_ADMIN]: [
    USER_LAYERS.ADMIN,
    USER_LAYERS.COMPANY_ADMIN,
    USER_LAYERS.MODERATOR,
    USER_LAYERS.CUSTOMER,
  ],
  [USER_LAYERS.ADMIN]: [USER_LAYERS.CUSTOMER],
  [USER_LAYERS.COMPANY_ADMIN]: [USER_LAYERS.MODERATOR],
  [USER_LAYERS.MODERATOR]: [],
  [USER_LAYERS.CUSTOMER]: [],
};

/**
 * Who may grant PER-USER permission overrides, and to which layer
 * (requirement #9). Deliberately narrower than MANAGEABLE_TARGET_LAYERS_BY:
 * an ADMIN can view/edit CUSTOMER accounts but was never asked to grant
 * them permissions, so it isn't listed here.
 */
export const PERMISSION_GRANTERS: Partial<Record<UserLayer, UserLayer>> = {
  [USER_LAYERS.SUPER_ADMIN]: USER_LAYERS.ADMIN,
  [USER_LAYERS.COMPANY_ADMIN]: USER_LAYERS.MODERATOR,
};

/** Resource keys a granter is allowed to include in a permission-override grant. */
export const GRANTABLE_RESOURCES_BY: Partial<Record<UserLayer, string[]>> = {
  [USER_LAYERS.SUPER_ADMIN]: Object.values(CORE_RESOURCES),
  [USER_LAYERS.COMPANY_ADMIN]: [
    CORE_RESOURCES.USERS,
    CORE_RESOURCES.COMMENTS,
    CORE_RESOURCES.REPORTS,
    CORE_RESOURCES.DASHBOARD,
  ],
};

/** Which layers SUPER_ADMIN / COMPANY_ADMIN are each allowed to create a dynamic ROLE for (requirement #3/#4/#7). */
export const CREATABLE_ROLE_LAYERS_BY: Partial<Record<UserLayer, UserLayer[]>> = {
  [USER_LAYERS.SUPER_ADMIN]: [USER_LAYERS.ADMIN, USER_LAYERS.COMPANY_ADMIN, USER_LAYERS.CUSTOMER],
  [USER_LAYERS.COMPANY_ADMIN]: [USER_LAYERS.MODERATOR],
};

/**
 * Which layers a non-Super-Admin actor is allowed to impersonate ("Login as
 * user") at all. SUPER_ADMIN is handled separately via its `isSuperAdmin`
 * bypass in getImpersonationIneligibleReason (may target any layer except
 * another SUPER_ADMIN), same pattern as every other table in this file.
 * CUSTOMER is deliberately absent from every entry here - a COMPANY_ADMIN
 * must never be able to impersonate a CUSTOMER, and omitting it from the
 * allow-list is what enforces that by default rather than needing a
 * separate deny-list.
 */
export const IMPERSONATION_TARGET_LAYERS_BY: Partial<Record<UserLayer, UserLayer[]>> = {
  [USER_LAYERS.COMPANY_ADMIN]: [USER_LAYERS.MODERATOR],
};

/** Resource keys that belong to each menu/route scope (used for menu-visibility and grant validation). */
export const SCOPE_RESOURCES = {
  SUPER_ADMIN_ADMIN: [
    CORE_RESOURCES.USERS,
    CORE_RESOURCES.ROLES,
    CORE_RESOURCES.MENUS,
    CORE_RESOURCES.AUDIT_LOG,
    CORE_RESOURCES.PERMISSIONS,
    CORE_RESOURCES.SETTINGS,
  ],
  COMPANY_ADMIN_MODERATOR: [CORE_RESOURCES.USERS, CORE_RESOURCES.COMMENTS, CORE_RESOURCES.REPORTS],
} as const;

type MinimalRole = { slug: string; isActive?: boolean };

/** Pure display helper - the role slugs a user holds, for UI badges/labels only. NEVER used for authority (see module doc comment). */
export function getRoleSlugs(roles: MinimalRole[]): string[] {
  return roles.filter((r) => r.isActive !== false).map((r) => r.slug);
}

export function isAdminAreaLayer(layer: UserLayer): boolean {
  return layer === USER_LAYERS.ADMIN;
}

export function isCompanyAdminAreaLayer(layer: UserLayer): boolean {
  return layer === USER_LAYERS.COMPANY_ADMIN || layer === USER_LAYERS.MODERATOR;
}

/**
 * Requirement #8/#15: can a user belonging to `actorLayer` create/assign a
 * new user into `targetLayer`?
 *
 * Deliberately has NO `isSuperAdmin` bypass, unlike every other check in
 * this file: CREATABLE_LAYERS_BY[SUPER_ADMIN] already lists exactly what the
 * spec grants it (ADMIN, COMPANY_ADMIN, CUSTOMER - requirement #8). A
 * blanket bypass here would let Super Admin create a MODERATOR directly,
 * which breaks the COMPANY_ADMIN-owns-its-MODERATORs invariant (`managedBy`
 * would have nowhere correct to point) - MODERATOR must only ever be
 * created through `/company-admin`, by a Company Admin.
 */
export function canCreateUserInLayer(actorLayer: UserLayer, targetLayer: UserLayer): boolean {
  return CREATABLE_LAYERS_BY[actorLayer]?.includes(targetLayer) ?? false;
}

/**
 * Requirement #3/#10: can a user belonging to `actorLayer` manage (view/
 * edit/deactivate) a user belonging to `targetLayer`?
 */
export function canManageLayer(actorLayer: UserLayer, targetLayer: UserLayer, isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true;
  return MANAGEABLE_TARGET_LAYERS_BY[actorLayer]?.includes(targetLayer) ?? false;
}

/**
 * Full target-user authority check: layer-hierarchy authority AND, for the
 * COMPANY_ADMIN -> MODERATOR relationship, ownership (requirement #10 -
 * COMPANY_ADMIN A must not manage COMPANY_ADMIN B's moderators).
 */
export function canManageTargetUser(params: {
  actorUserId: string;
  actorLayer: UserLayer;
  isSuperAdmin: boolean;
  targetUserId: string;
  targetLayer: UserLayer;
  targetManagedBy?: string | null;
}): boolean {
  const { actorUserId, actorLayer, isSuperAdmin, targetUserId, targetLayer, targetManagedBy } = params;
  if (isSuperAdmin) return true;
  if (actorUserId === targetUserId) return false; // never manage yourself through this path
  if (!canManageLayer(actorLayer, targetLayer)) return false;

  if (actorLayer === USER_LAYERS.COMPANY_ADMIN && targetLayer === USER_LAYERS.MODERATOR) {
    return targetManagedBy === actorUserId;
  }
  return true;
}

/**
 * Requirement #9: can the actor grant `resource`/`action` as a per-user
 * permission override to a user belonging to `targetLayer`? Enforces:
 * no self-grant, actor must be a granter layer for the target's layer,
 * resource must be inside that granter's allow-list, and (unless the actor
 * is Super Admin) the actor must already hold that exact permission
 * themselves - no lower-level user can grant authority it doesn't have.
 */
export function canGrantPermissionOverride(params: {
  actorUserId: string;
  actorLayer: UserLayer;
  actorEffectivePermissions: PermissionMap;
  isSuperAdmin: boolean;
  targetUserId: string;
  targetLayer: UserLayer;
  targetManagedBy?: string | null;
  resource: string;
  action: PermissionAction;
}): boolean {
  const {
    actorUserId,
    actorLayer,
    actorEffectivePermissions,
    isSuperAdmin,
    targetUserId,
    targetLayer,
    targetManagedBy,
    resource,
    action,
  } = params;

  if (actorUserId === targetUserId) return false; // no self-grant, ever

  if (isSuperAdmin) return true;

  if (PERMISSION_GRANTERS[actorLayer] !== targetLayer) return false;

  // Ownership: COMPANY_ADMIN may only grant to its OWN moderators.
  if (actorLayer === USER_LAYERS.COMPANY_ADMIN && targetManagedBy !== actorUserId) return false;

  const grantable = GRANTABLE_RESOURCES_BY[actorLayer] ?? [];
  if (!grantable.includes(resource)) return false;

  // No lower-level user may grant authority it doesn't itself hold.
  return hasPermission(actorEffectivePermissions, resource, action);
}

/**
 * Can the actor create/edit/deactivate this dynamic ROLE document?
 * SUPER_ADMIN: always. COMPANY_ADMIN: only a role it created itself,
 * targeting MODERATOR (never the shared system default, managedBy: null,
 * nor a peer COMPANY_ADMIN's role). Everyone else: never.
 */
export function canManageRole(params: {
  isSuperAdmin: boolean;
  actorUserId: string;
  actorLayer: UserLayer;
  role: { userLayer: UserLayer; managedBy?: string | null };
}): boolean {
  const { isSuperAdmin, actorUserId, actorLayer, role } = params;
  if (isSuperAdmin) return true;
  if (actorLayer !== USER_LAYERS.COMPANY_ADMIN) return false;
  if (role.userLayer !== USER_LAYERS.MODERATOR) return false;
  return role.managedBy === actorUserId;
}

/**
 * Requirement #21 (plus the additional Company Admin account-access
 * requirements): is `target` eligible to be impersonated by this actor?
 * Single source of truth for both the server (auth-service.ts - the real
 * enforcement) and the client-side row-action filter (UX only, never
 * trusted) - keeping them in sync automatically instead of two hand-written
 * copies of the same rules. Callers still independently verify the actor
 * itself is allowed to impersonate anyone at all (requireImpersonationActor()
 * at the route boundary, guard.ts); this only encodes TARGET eligibility for
 * a given actor, layer-hierarchy authority to impersonate that layer, and
 * (for COMPANY_ADMIN -> MODERATOR) ownership.
 */
export function getImpersonationIneligibleReason(params: {
  actorUserId: string;
  actorLayer: UserLayer;
  isSuperAdmin: boolean;
  targetUserId: string;
  targetUserLayer: UserLayer;
  targetStatus: string;
  targetManagedBy?: string | null;
}): string | null {
  const { actorUserId, actorLayer, isSuperAdmin, targetUserId, targetUserLayer, targetStatus, targetManagedBy } =
    params;
  if (actorUserId === targetUserId) return "You cannot impersonate your own account.";

  if (isSuperAdmin) {
    if (targetUserLayer === USER_LAYERS.SUPER_ADMIN) return "Super Admin accounts cannot be impersonated.";
  } else {
    if (!IMPERSONATION_TARGET_LAYERS_BY[actorLayer]?.includes(targetUserLayer)) {
      return "You are not authorized to access this account.";
    }
    if (
      actorLayer === USER_LAYERS.COMPANY_ADMIN &&
      targetUserLayer === USER_LAYERS.MODERATOR &&
      targetManagedBy !== actorUserId
    ) {
      return "You can only access moderators you manage.";
    }
  }

  if (targetStatus !== "ACTIVE") return "Only active accounts can be impersonated.";
  return null;
}

/** The dashboard tree a user should land on after login (requirement #4). */
export function getDefaultLandingRoute(access: { isSuperAdmin: boolean; userLayer: UserLayer }): string {
  if (access.isSuperAdmin || isAdminAreaLayer(access.userLayer)) return "/admin";
  if (isCompanyAdminAreaLayer(access.userLayer)) return "/company-admin";
  return "/dashboard";
}
