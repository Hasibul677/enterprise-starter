/**
 * The authority engine for the 5-role hierarchy:
 *
 *   SUPER_ADMIN
 *     |-- ADMIN
 *     `-- NORMAL_ADMIN
 *           `-- MODERATOR
 *   CUSTOMER (independent)
 *
 * This module is intentionally pure (no DB access) so it stays trivial to
 * unit test - see tests/unit/role-hierarchy.test.ts. Callers (services,
 * route handlers) own resolving DB documents into the plain slugs/ids this
 * module works with.
 *
 * SUPER_ADMIN is handled by its own `isSuperAdmin` flag everywhere (as it
 * already was pre-hierarchy) and bypasses every check in this file - it is
 * still listed in the tables below for documentation/completeness.
 */
import { CORE_RESOURCES, ROLE_SLUGS, type PermissionMap, type PermissionAction, type RoleSlug } from "./constants";
import { hasPermission } from "./merge";

/** Which roles a user holding `key` is allowed to CREATE a brand-new user as (requirement #8). */
export const CREATABLE_ROLES_BY: Record<RoleSlug, RoleSlug[]> = {
  [ROLE_SLUGS.SUPER_ADMIN]: [ROLE_SLUGS.ADMIN, ROLE_SLUGS.NORMAL_ADMIN, ROLE_SLUGS.CUSTOMER],
  [ROLE_SLUGS.ADMIN]: [ROLE_SLUGS.CUSTOMER],
  [ROLE_SLUGS.NORMAL_ADMIN]: [ROLE_SLUGS.MODERATOR],
  [ROLE_SLUGS.MODERATOR]: [],
  [ROLE_SLUGS.CUSTOMER]: [],
};

/** Which roles a user holding `key` is allowed to VIEW/EDIT/DEACTIVATE an EXISTING user of (requirement #3/#10). */
export const MANAGEABLE_TARGET_ROLES_BY: Record<RoleSlug, RoleSlug[]> = {
  [ROLE_SLUGS.SUPER_ADMIN]: [ROLE_SLUGS.ADMIN, ROLE_SLUGS.NORMAL_ADMIN, ROLE_SLUGS.MODERATOR, ROLE_SLUGS.CUSTOMER],
  [ROLE_SLUGS.ADMIN]: [ROLE_SLUGS.CUSTOMER],
  [ROLE_SLUGS.NORMAL_ADMIN]: [ROLE_SLUGS.MODERATOR],
  [ROLE_SLUGS.MODERATOR]: [],
  [ROLE_SLUGS.CUSTOMER]: [],
};

/**
 * Who may grant PER-USER permission overrides, and to which role
 * (requirement #9). Deliberately narrower than MANAGEABLE_TARGET_ROLES_BY:
 * an ADMIN can view/edit CUSTOMER accounts but was never asked to grant
 * them permissions, so it isn't listed here.
 */
export const PERMISSION_GRANTERS: Partial<Record<RoleSlug, RoleSlug>> = {
  [ROLE_SLUGS.SUPER_ADMIN]: ROLE_SLUGS.ADMIN,
  [ROLE_SLUGS.NORMAL_ADMIN]: ROLE_SLUGS.MODERATOR,
};

/** Resource keys a granter is allowed to include in a permission-override grant. */
export const GRANTABLE_RESOURCES_BY: Partial<Record<RoleSlug, string[]>> = {
  [ROLE_SLUGS.SUPER_ADMIN]: Object.values(CORE_RESOURCES),
  [ROLE_SLUGS.NORMAL_ADMIN]: [CORE_RESOURCES.USERS, CORE_RESOURCES.COMMENTS, CORE_RESOURCES.REPORTS, CORE_RESOURCES.DASHBOARD],
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
  NORMAL_ADMIN_MODERATOR: [CORE_RESOURCES.USERS, CORE_RESOURCES.COMMENTS, CORE_RESOURCES.REPORTS],
} as const;

type MinimalRole = { slug: string; isActive?: boolean };

export function getRoleSlugs(roles: MinimalRole[]): RoleSlug[] {
  return roles.filter((r) => r.isActive !== false).map((r) => r.slug as RoleSlug);
}

function isInAdminArea(slugs: RoleSlug[]): boolean {
  return slugs.includes(ROLE_SLUGS.ADMIN);
}

function isInNormalAdminArea(slugs: RoleSlug[]): boolean {
  return slugs.includes(ROLE_SLUGS.NORMAL_ADMIN) || slugs.includes(ROLE_SLUGS.MODERATOR);
}

/**
 * Requirement #8/#15: can a holder of `actorSlugs` create/assign a user as
 * `targetSlug`?
 *
 * Deliberately has NO `isSuperAdmin` bypass, unlike every other check in
 * this file: CREATABLE_ROLES_BY[SUPER_ADMIN] already lists exactly what the
 * spec grants it (ADMIN, NORMAL_ADMIN, CUSTOMER - requirement #8), and a
 * user with the isSuperAdmin flag always holds the `super-admin` slug in
 * `actorSlugs` too (see current-user.ts), so the table lookup alone gives
 * the identical, correct answer for Super Admin. A blanket bypass here
 * would let Super Admin assign MODERATOR directly, which breaks the
 * NORMAL_ADMIN-owns-its-MODERATORs invariant (`managedBy` would have
 * nowhere correct to point) - MODERATOR must only ever be created through
 * `/normal-admin`, by a Normal Admin.
 */
export function canAssignRole(actorSlugs: RoleSlug[], targetSlug: string): boolean {
  return actorSlugs.some((slug) => CREATABLE_ROLES_BY[slug]?.includes(targetSlug as RoleSlug));
}

/**
 * Requirement #3/#10: can a holder of `actorSlugs` manage (view/edit/
 * deactivate) a user whose roles are `targetSlugs`?
 *
 * Deliberately requires EVERY role the target holds to be inside the
 * actor's manageable set (not just any one of them) - this app supports
 * multi-role users (`mergeRolePermissions()` is a UNION across all of a
 * user's roles), so a target holding e.g. both `customer` AND `super-admin`
 * must never be manageable by an Admin just because `customer` happens to
 * match; an actor who can't fully account for every role a target holds has
 * no business touching that user at all.
 */
export function canManageRoleSlugs(actorSlugs: RoleSlug[], targetSlugs: RoleSlug[], isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true;
  if (targetSlugs.length === 0) return false;
  const manageable = new Set(actorSlugs.flatMap((slug) => MANAGEABLE_TARGET_ROLES_BY[slug] ?? []));
  return targetSlugs.every((targetSlug) => manageable.has(targetSlug));
}

/**
 * Full target-user authority check: role-hierarchy authority AND, for the
 * NORMAL_ADMIN -> MODERATOR relationship, ownership (requirement #10 -
 * NORMAL_ADMIN A must not manage NORMAL_ADMIN B's moderators).
 */
export function canManageTargetUser(params: {
  actorUserId: string;
  actorSlugs: RoleSlug[];
  isSuperAdmin: boolean;
  targetUserId: string;
  targetSlugs: RoleSlug[];
  targetManagedBy?: string | null;
}): boolean {
  const { actorUserId, actorSlugs, isSuperAdmin, targetUserId, targetSlugs, targetManagedBy } = params;
  if (isSuperAdmin) return true;
  if (actorUserId === targetUserId) return false; // never manage yourself through this path
  if (!canManageRoleSlugs(actorSlugs, targetSlugs)) return false;

  if (actorSlugs.includes(ROLE_SLUGS.NORMAL_ADMIN) && targetSlugs.includes(ROLE_SLUGS.MODERATOR)) {
    return targetManagedBy === actorUserId;
  }
  return true;
}

/**
 * Requirement #9: can the actor grant `resource`/`action` as a per-user
 * permission override to a user whose roles are `targetSlugs`? Enforces:
 * no self-grant, actor must hold a granter role for the target's role,
 * resource must be inside that granter's allow-list, and (unless the actor
 * is Super Admin) the actor must already hold that exact permission
 * themselves - no lower-level user can grant authority it doesn't have.
 */
export function canGrantPermissionOverride(params: {
  actorUserId: string;
  actorSlugs: RoleSlug[];
  actorEffectivePermissions: PermissionMap;
  isSuperAdmin: boolean;
  targetUserId: string;
  targetSlugs: RoleSlug[];
  targetManagedBy?: string | null;
  resource: string;
  action: PermissionAction;
}): boolean {
  const { actorUserId, actorSlugs, actorEffectivePermissions, isSuperAdmin, targetUserId, targetSlugs, targetManagedBy, resource, action } =
    params;

  if (actorUserId === targetUserId) return false; // no self-grant, ever

  if (isSuperAdmin) return true;

  // Same multi-role caution as canManageRoleSlugs(): the target must hold
  // ONLY the expected grantee role, not merely include it alongside
  // something else the granter has no business touching.
  const granterSlug = actorSlugs.find((slug) => {
    const granteeSlug = PERMISSION_GRANTERS[slug];
    return granteeSlug !== undefined && targetSlugs.length > 0 && targetSlugs.every((t) => t === granteeSlug);
  });
  if (!granterSlug) return false;

  // Ownership: NORMAL_ADMIN may only grant to its OWN moderators.
  if (granterSlug === ROLE_SLUGS.NORMAL_ADMIN && targetManagedBy !== actorUserId) return false;

  const grantable = GRANTABLE_RESOURCES_BY[granterSlug] ?? [];
  if (!grantable.includes(resource)) return false;

  // No lower-level user may grant authority it doesn't itself hold.
  return hasPermission(actorEffectivePermissions, resource, action);
}

/**
 * Requirement #21: is `target` eligible to be impersonated by `actorUserId`?
 * Single source of truth for both the server (auth-service.ts - the real
 * enforcement) and the client-side row-action filter (UX only, never
 * trusted) - keeping them in sync automatically instead of two hand-written
 * copies of the same 3 rules. Callers already know the actor is a genuine
 * Super Admin (requireSuperAdmin() at the route boundary); this only
 * encodes TARGET eligibility, matching the "SUPER_ADMIN -> SUPER_ADMIN not
 * allowed" default and the "can't impersonate a disabled/blocked account"
 * rule (a normal login would reject them too).
 */
export function getImpersonationIneligibleReason(params: {
  actorUserId: string;
  targetUserId: string;
  targetSlugs: RoleSlug[];
  targetStatus: string;
}): string | null {
  const { actorUserId, targetUserId, targetSlugs, targetStatus } = params;
  if (actorUserId === targetUserId) return "You cannot impersonate your own account.";
  if (targetSlugs.includes(ROLE_SLUGS.SUPER_ADMIN)) return "Super Admin accounts cannot be impersonated.";
  if (targetStatus !== "ACTIVE") return "Only active accounts can be impersonated.";
  return null;
}

export function isAdminAreaRole(actorSlugs: RoleSlug[]): boolean {
  return isInAdminArea(actorSlugs);
}

export function isNormalAdminAreaRole(actorSlugs: RoleSlug[]): boolean {
  return isInNormalAdminArea(actorSlugs);
}

/** The dashboard tree a user should land on after login (requirement #4). */
export function getDefaultLandingRoute(access: { isSuperAdmin: boolean; roleSlugs: RoleSlug[] }): string {
  if (access.isSuperAdmin || isInAdminArea(access.roleSlugs)) return "/admin";
  if (isInNormalAdminArea(access.roleSlugs)) return "/normal-admin";
  return "/dashboard";
}
