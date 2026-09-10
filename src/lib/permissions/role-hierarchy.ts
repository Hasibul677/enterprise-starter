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

/** Which layers a user belonging to `key` is allowed to EDIT/DEACTIVATE (full manage authority) an EXISTING user of (requirement #3/#10). See VIEWABLE_TARGET_LAYERS_BY below for the broader read-only superset. */
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
 * Fixed, linear positional order for VIEW-ONLY layer visibility ("FINAL RBAC
 * RULE": a user can never view any layer above/parent to its own, and - with
 * SUPER_ADMIN as the sole exception - never its own layer's peers either,
 * only the layers strictly below it). This is deliberately a flat, linear
 * cut - independent of the tree-shaped MANAGEABLE_TARGET_LAYERS_BY authority
 * above (where SUPER_ADMIN's two branches, ADMIN and COMPANY_ADMIN, are
 * siblings, not parent/child) - that table still separately governs real
 * write authority and is completely unaffected by this.
 */
const LAYER_VISIBILITY_ORDER: UserLayer[] = [
  USER_LAYERS.SUPER_ADMIN,
  USER_LAYERS.ADMIN,
  USER_LAYERS.COMPANY_ADMIN,
  USER_LAYERS.MODERATOR,
  USER_LAYERS.CUSTOMER,
];

/**
 * Which layers a user belonging to `actorLayer` may ever see at all (list/
 * tab visibility, read-only detail) - every layer strictly below it in the
 * fixed hierarchy above, NEVER a parent/higher layer, regardless of
 * permissions. Only SUPER_ADMIN can ever see the SUPER_ADMIN layer, and by
 * the same rule it's the only layer that can see its OWN layer's tab at all
 * (its peers) - every other layer (ADMIN, COMPANY_ADMIN, MODERATOR) sees
 * strictly the layers below it, never its own peers. This only answers "is
 * this layer even a candidate" - whether it's actually shown/reachable
 * still depends on the caller separately holding the relevant VIEW
 * permission (e.g. `users.view`) on top of this, so permissions can only
 * narrow this list, never widen it.
 */
export function getViewableLayerCandidates(actorLayer: UserLayer): UserLayer[] {
  const idx = LAYER_VISIBILITY_ORDER.indexOf(actorLayer);
  if (idx === -1) return [];
  // SUPER_ADMIN is the sole exception that can see its own layer (and thus
  // its own peers) - everyone else only sees layers strictly below them.
  const start = actorLayer === USER_LAYERS.SUPER_ADMIN ? idx : idx + 1;
  return LAYER_VISIBILITY_ORDER.slice(start);
}

/**
 * Which layers a user belonging to `key` is allowed to VIEW (list/read-only
 * detail) - see getViewableLayerCandidates() above: everything strictly
 * below it in the fixed 5-layer hierarchy, never a parent/higher layer, and
 * (SUPER_ADMIN aside) never its own layer's peers either. A strict superset
 * of MANAGEABLE_TARGET_LAYERS_BY for every layer (e.g. a COMPANY_ADMIN may
 * now VIEW - but never edit/deactivate/reassign-role/grant-permissions/
 * impersonate - any CUSTOMER account, on top of its full MODERATOR
 * management). Every manage-affecting check (edit, delete, role assignment,
 * permission overrides, impersonation) must keep using
 * MANAGEABLE_TARGET_LAYERS_BY / canManageTargetUser() or the dedicated
 * PERMISSION_GRANTERS / IMPERSONATION_TARGET_LAYERS_BY tables - never this
 * one - so read-only access can never be leveraged into write access.
 */
export const VIEWABLE_TARGET_LAYERS_BY: Record<UserLayer, UserLayer[]> = {
  [USER_LAYERS.SUPER_ADMIN]: getViewableLayerCandidates(USER_LAYERS.SUPER_ADMIN),
  [USER_LAYERS.ADMIN]: getViewableLayerCandidates(USER_LAYERS.ADMIN),
  [USER_LAYERS.COMPANY_ADMIN]: getViewableLayerCandidates(USER_LAYERS.COMPANY_ADMIN),
  [USER_LAYERS.MODERATOR]: getViewableLayerCandidates(USER_LAYERS.MODERATOR),
  [USER_LAYERS.CUSTOMER]: getViewableLayerCandidates(USER_LAYERS.CUSTOMER),
};

/**
 * Which layer tabs actually render on the Users ("User Management") page for
 * a given actor: the fixed hierarchy candidates above (every layer strictly
 * below its own - or, for SUPER_ADMIN only, its own layer too - never a
 * parent) are the ceiling - permissions can only ever narrow that list,
 * never widen it past a parent layer or the actor's own peers. Since `users` is a
 * single blanket resource (no per-layer granularity), the one `users.view`
 * check is applied to the WHOLE candidate set at once rather than per layer -
 * checking each layer independently against the same single permission
 * would either always pass or always fail together anyway, and doing it
 * per-layer risks reading as "every tab requires its own separate grant" and
 * over-filtering down to zero tabs for an actor who does hold `users.view`.
 * A CUSTOMER actor never reaches this at all (blocked earlier by
 * requireAdminAreaPage()/requireCompanyAdminAreaPage() - it has no User
 * Management module access, full stop).
 */
export function getVisibleUserManagementLayers(access: {
  isSuperAdmin: boolean;
  userLayer: UserLayer;
  permissions: PermissionMap;
}): UserLayer[] {
  if (access.isSuperAdmin) return LAYER_VISIBILITY_ORDER;
  if (!hasPermission(access.permissions, CORE_RESOURCES.USERS, "view")) return [];
  return getViewableLayerCandidates(access.userLayer);
}

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

/**
 * Which layers SUPER_ADMIN / COMPANY_ADMIN are each allowed to create a
 * dynamic ROLE for (requirement #3/#4/#7). SUPER_ADMIN may also create
 * additional roles targeting its OWN layer - both the Role schema
 * (role-create.schema.ts) and Mongoose model already allow `userLayer:
 * "SUPER_ADMIN"`, and canManageRole()'s unconditional `isSuperAdmin` bypass
 * already lets a Super Admin manage such a role once it exists; this table
 * was the only remaining gate.
 */
export const CREATABLE_ROLE_LAYERS_BY: Partial<Record<UserLayer, UserLayer[]>> = {
  [USER_LAYERS.SUPER_ADMIN]: [
    USER_LAYERS.SUPER_ADMIN,
    USER_LAYERS.ADMIN,
    USER_LAYERS.COMPANY_ADMIN,
    USER_LAYERS.CUSTOMER,
  ],
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
 * separate deny-list. ADMIN's entry additionally requires the actor to hold
 * the `impersonation` permission (see requireImpersonationActor() in
 * guard.ts) - unlike COMPANY_ADMIN, an ADMIN is never unconditionally
 * allowed to impersonate; this table only says WHICH layer it may target
 * once it does hold that permission (its own managed CUSTOMER accounts,
 * same target set as its ordinary user-management authority).
 */
export const IMPERSONATION_TARGET_LAYERS_BY: Partial<Record<UserLayer, UserLayer[]>> = {
  [USER_LAYERS.ADMIN]: [USER_LAYERS.CUSTOMER],
  [USER_LAYERS.COMPANY_ADMIN]: [USER_LAYERS.MODERATOR],
};

/**
 * Resource keys that belong to each menu/route scope (used for
 * menu-visibility and grant validation). There is deliberately no separate
 * "impersonation" resource here - "Login as User" is the `login_as` ACTION
 * on the USERS resource (see PERMISSION_ACTIONS in constants.ts and
 * resourceOptionsForLayer() in layer-mappings.ts, which hides that specific
 * action's column outside an ADMIN-layer role/user).
 */
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
 * Requirement #3/#10: can a user belonging to `actorLayer` fully manage
 * (edit/deactivate/reassign-role/grant-permissions) a user belonging to
 * `targetLayer`? See canViewLayer() below for the broader read-only check -
 * never substitute that one here, or read-only access silently becomes
 * write access.
 */
export function canManageLayer(actorLayer: UserLayer, targetLayer: UserLayer, isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true;
  return MANAGEABLE_TARGET_LAYERS_BY[actorLayer]?.includes(targetLayer) ?? false;
}

/**
 * Can a user belonging to `actorLayer` VIEW (list / read-only detail) a user
 * belonging to `targetLayer`? A superset of canManageLayer() - e.g.
 * COMPANY_ADMIN can view CUSTOMER accounts without being able to manage
 * them. Use this ONLY for read paths (list scoping, detail GET); every
 * write path (edit, delete, role assignment, permission overrides,
 * impersonation) must keep using canManageLayer()/canManageTargetUser() or
 * their own dedicated tables.
 */
export function canViewLayer(actorLayer: UserLayer, targetLayer: UserLayer, isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true;
  return VIEWABLE_TARGET_LAYERS_BY[actorLayer]?.includes(targetLayer) ?? false;
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
 * Read-only counterpart to canManageTargetUser() - layer-hierarchy VIEW
 * authority (canViewLayer(), a superset of canManageLayer()) plus the same
 * COMPANY_ADMIN -> MODERATOR ownership rule. Used ONLY to gate read paths
 * (list scoping, detail GET) - never for edit/delete/role/permission/
 * impersonation authority, which must keep calling canManageTargetUser().
 */
export function canViewTargetUser(params: {
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
  if (!canViewLayer(actorLayer, targetLayer)) return false;

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
 * requirements, and the permission-gated ADMIN -> CUSTOMER "Login as User"
 * capability): is `target` eligible to be impersonated by this actor?
 * Single source of truth for both the server (auth-service.ts - the real
 * enforcement) and the client-side row-action filter (UX only, never
 * trusted) - keeping them in sync automatically instead of two hand-written
 * copies of the same rules. Callers still independently verify the actor
 * itself is allowed to impersonate anyone at all (requireImpersonationActor()
 * at the route boundary, guard.ts - for ADMIN this additionally requires the
 * `impersonation` permission); this only encodes TARGET eligibility for a
 * given actor, layer-hierarchy authority to impersonate that layer, and
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
