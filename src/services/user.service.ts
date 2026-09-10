import { userRepository } from "@/repositories/user.repository";
import { roleRepository } from "@/repositories/role.repository";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { hashPassword, isPasswordStrongEnough } from "@/lib/security/password";
import { ValidationError, NotFoundError, ConflictError, AuthorizationError } from "@/lib/errors/app-error";
import { USER_LAYERS } from "@/lib/permissions/constants";
import {
  canCreateUserInLayer,
  canGrantPermissionOverride,
  canManageTargetUser,
  canViewTargetUser,
  VIEWABLE_TARGET_LAYERS_BY,
} from "@/lib/permissions/role-hierarchy";
import type { ResolvedAccess } from "@/lib/auth/current-user";
import type { UserCreateInput } from "@/features/users/schemas/user-create.schema";
import type { UserUpdateInput } from "@/features/users/schemas/user-update.schema";
import type { PermissionAction, PermissionMap, UserLayer } from "@/lib/permissions/constants";
import type { UserDocument } from "@/models/user.model";
import type { RoleDocument } from "@/models/role.model";

/**
 * Every route in this file already passed requireAdminAreaAccess() or
 * requireCompanyAdminAreaAccess() (the actor belongs in SOME admin-capable
 * dashboard) plus requirePermission(USERS, ...) (the actor can act on users
 * AT ALL). Everything below is the finer-grained hierarchy authority those
 * two checks can't express on their own: who specifically the actor is
 * allowed to create/view/edit, per role-hierarchy.ts (requirement #3/#8/#10).
 */

/**
 * An inactive role contributes nothing (mergeRolePermissions() skips it),
 * so assigning one to a user would silently create a role reference that
 * does nothing - reject it outright rather than let it happen quietly.
 * Combined with role.service.ts's "can't deactivate a SYSTEM role that's
 * still assigned" guard, a SYSTEM role can never legitimately be both
 * inactive AND held by a user going forward (custom roles may now be
 * deactivated while assigned - see role.service.ts#updateRole).
 */
function assertRolesActive(roles: { name: string; isActive: boolean }[]) {
  const inactive = roles.filter((r) => !r.isActive);
  if (inactive.length > 0) {
    throw new ValidationError("One or more roles are inactive and cannot be assigned.", [
      { field: "roleIds", message: `Inactive role(s): ${inactive.map((r) => r.name).join(", ")}.` },
    ]);
  }
}

/**
 * Requirement #9: every role assigned to one user must target the SAME
 * fixed layer - a user's userLayer is derived from its roles at creation
 * time and never mixed. Roles carry permissions, not hierarchy, but a role
 * still only ever applies within the one layer it was built for.
 */
function resolveRolesLayer(roles: { userLayer: UserLayer }[]): UserLayer {
  const layers = new Set(roles.map((r) => r.userLayer));
  if (layers.size !== 1) {
    throw new ValidationError("All selected roles must target the same user layer.", [
      { field: "roleIds", message: "Roles from different layers cannot be assigned to the same user." },
    ]);
  }
  return layers.values().next().value as UserLayer;
}

/**
 * A dynamic role with an owner (Role.managedBy - requirement #6) may only
 * ever be assigned by the COMPANY_ADMIN who created it; a role with no
 * owner (managedBy: null - a system default or a SUPER_ADMIN-created role)
 * is assignable by any actor otherwise authorized to reach this layer.
 */
function assertRolesAssignableByActor(roles: RoleDocument[], access: ResolvedAccess) {
  if (access.isSuperAdmin) return;
  const actorUserId = String(access.user._id);
  for (const role of roles) {
    const roleManagedBy = role.managedBy ? String(role.managedBy) : null;
    if (roleManagedBy !== null && roleManagedBy !== actorUserId) {
      throw new AuthorizationError(`You are not authorized to assign the '${role.name}' role.`);
    }
  }
}

function buildUserListScopeFilter(access: ResolvedAccess): Record<string, unknown> {
  if (access.isSuperAdmin) return {};

  const viewableLayers = VIEWABLE_TARGET_LAYERS_BY[access.userLayer] ?? [];
  if (viewableLayers.length === 0) {
    return { _id: { $in: [] } }; // no viewable layers - matches nothing
  }

  // COMPANY_ADMIN only ever manages its OWN moderators (requirement #10),
  // but VIEWS every CUSTOMER unrestricted (same as ADMIN's unrestricted
  // CUSTOMER access) - so the ownership scope applies to the MODERATOR
  // layer alone, never blanket across every layer the actor can view.
  if (access.userLayer === USER_LAYERS.COMPANY_ADMIN) {
    const actorId = String(access.user._id);
    const unownedLayers = viewableLayers.filter((l) => l !== USER_LAYERS.MODERATOR);
    return {
      $or: [
        { userLayer: USER_LAYERS.MODERATOR, managedBy: actorId },
        ...(unownedLayers.length > 0 ? [{ userLayer: { $in: unownedLayers } }] : []),
      ],
    };
  }

  return { userLayer: { $in: viewableLayers } };
}

/**
 * Fetches a single user with full MANAGE authority (canManageTargetUser()) -
 * i.e. the actor could also edit/deactivate/reassign-role/grant-permissions
 * for this exact user, not merely view them. Used wherever a target user is
 * fetched as a prerequisite to a write-adjacent read (e.g. the permission-
 * overrides GET, which reveals grantable state) so a COMPANY_ADMIN (etc.)
 * can't read another actor's users by guessing an id, even though the list
 * endpoint already scopes correctly (requirement #10). For a PURE read-only
 * detail view where view-only access is intentionally broader than manage
 * access (e.g. COMPANY_ADMIN viewing a CUSTOMER), use getUserForViewer()
 * instead - never relax the check here, or a read-only surface silently
 * gains write authority too.
 */
export async function getUserForActor(userId: string, access: ResolvedAccess) {
  const target = await userRepository.findById(userId);
  if (!target) throw new NotFoundError("User not found.");

  if (!access.isSuperAdmin) {
    const authorized =
      String(access.user._id) === userId ||
      canManageTargetUser({
        actorUserId: String(access.user._id),
        actorLayer: access.userLayer,
        isSuperAdmin: access.isSuperAdmin,
        targetUserId: userId,
        targetLayer: target.userLayer as UserLayer,
        targetManagedBy: target.managedBy ? String(target.managedBy) : null,
      });
    if (!authorized) {
      throw new AuthorizationError("You do not have authority to view this user.");
    }
  }

  return target;
}

/**
 * Fetches a single user with VIEW-ONLY authority (canViewTargetUser()) - a
 * superset of getUserForActor()'s manage authority, e.g. it also lets a
 * COMPANY_ADMIN look at (but not edit/deactivate/reassign-role/grant-
 * permissions/impersonate) its CUSTOMER accounts. Used ONLY by the plain
 * GET /api/users/[id] detail route; every write-adjacent read (permission
 * overrides, etc.) must keep using getUserForActor() above so read-only
 * access can never be leveraged into write access.
 */
export async function getUserForViewer(userId: string, access: ResolvedAccess) {
  const target = await userRepository.findById(userId);
  if (!target) throw new NotFoundError("User not found.");

  if (!access.isSuperAdmin) {
    const authorized =
      String(access.user._id) === userId ||
      canViewTargetUser({
        actorUserId: String(access.user._id),
        actorLayer: access.userLayer,
        isSuperAdmin: access.isSuperAdmin,
        targetUserId: userId,
        targetLayer: target.userLayer as UserLayer,
        targetManagedBy: target.managedBy ? String(target.managedBy) : null,
      });
    if (!authorized) {
      throw new AuthorizationError("You do not have authority to view this user.");
    }
  }

  return target;
}

/** Admin-initiated user creation - explicitly allows setting roles/status, unlike public registration. */
export async function adminCreateUser(input: UserCreateInput, access: ResolvedAccess) {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) throw new ConflictError("A user with this email already exists.");

  if (!isPasswordStrongEnough(input.password)) {
    throw new ValidationError("Password does not meet the minimum strength requirements.", [
      { field: "password", message: "Use at least 8 characters with upper, lower, and a digit." },
    ]);
  }

  const roles = await roleRepository.findByIds(input.roleIds);
  if (roles.length !== input.roleIds.length) {
    throw new ValidationError("One or more role IDs are invalid.", [
      { field: "roleIds", message: "Invalid role reference." },
    ]);
  }
  assertRolesActive(roles);

  const actorUserId = String(access.user._id);
  const actorLayer: UserLayer = access.isSuperAdmin ? USER_LAYERS.SUPER_ADMIN : access.userLayer;
  const targetLayer = resolveRolesLayer(roles as unknown as { userLayer: UserLayer }[]);

  if (!canCreateUserInLayer(actorLayer, targetLayer)) {
    throw new AuthorizationError(`You are not authorized to create a user in the '${targetLayer}' layer.`);
  }
  assertRolesAssignableByActor(roles, access);

  // Ownership: a MODERATOR created here is always created by its COMPANY_ADMIN
  // (the only actor canCreateUserInLayer() ever lets request the MODERATOR layer).
  const managedBy = targetLayer === USER_LAYERS.MODERATOR ? actorUserId : null;

  const passwordHash = await hashPassword(input.password);
  const user = await userRepository.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    passwordHash,
    roles: input.roleIds as unknown as UserDocument["roles"],
    userLayer: targetLayer,
    status: input.status,
    managedBy: managedBy as unknown as UserDocument["managedBy"],
    createdBy: actorUserId as unknown as UserDocument["createdBy"],
  });

  await auditLogRepository.record({
    actorUserId,
    targetUserId: String(user._id),
    action: "USER_CREATED",
    entityType: "User",
    entityId: String(user._id),
    metadata: { userLayer: targetLayer },
  });

  return user;
}

export async function updateUser(userId: string, input: UserUpdateInput, access: ResolvedAccess) {
  const target = await userRepository.findById(userId);
  if (!target) throw new NotFoundError("User not found.");

  const actorUserId = String(access.user._id);
  const targetLayer = target.userLayer as UserLayer;
  const targetManagedBy = target.managedBy ? String(target.managedBy) : null;

  // Requirement #9/#15 - absolutely no one, Super Admin included, may
  // change their OWN role assignments through this endpoint. This is a
  // hard rule independent of the isSuperAdmin bypass below: Super Admin
  // already has full authority, so self-role-editing is never a privilege
  // *escalation* for them, but it's still a self-lockout / self-tampering
  // risk (e.g. accidentally dropping their own super-admin role) the spec
  // explicitly calls out. A Super Admin needing to change their own roles
  // must do it as a different actor or via the seed script.
  if (input.roleIds && actorUserId === userId) {
    throw new AuthorizationError("You cannot modify your own role assignments.");
  }

  if (!access.isSuperAdmin) {
    if (
      !canManageTargetUser({
        actorUserId,
        actorLayer: access.userLayer,
        isSuperAdmin: access.isSuperAdmin,
        targetUserId: userId,
        targetLayer,
        targetManagedBy,
      })
    ) {
      throw new AuthorizationError("You do not have authority to manage this user.");
    }
  }

  const previousRoleIds = ((target.roles ?? []) as unknown as { _id: unknown }[]).map((r) => String(r._id ?? r));

  if (input.roleIds) {
    const roles = await roleRepository.findByIds(input.roleIds);
    if (roles.length !== input.roleIds.length) {
      throw new ValidationError("One or more role IDs are invalid.", [
        { field: "roleIds", message: "Invalid role reference." },
      ]);
    }
    assertRolesActive(roles);

    // A user's layer is fixed at creation and never changes here - every
    // newly-selected role must still target that same layer (requirement #9).
    const newLayer = resolveRolesLayer(roles as unknown as { userLayer: UserLayer }[]);
    if (newLayer !== targetLayer) {
      throw new ValidationError(`Roles must target this user's '${targetLayer}' layer.`, [
        {
          field: "roleIds",
          message: `This user belongs to the '${targetLayer}' layer and cannot be reassigned to a different one.`,
        },
      ]);
    }
    assertRolesAssignableByActor(roles, access);
  }

  const previousStatus = target.status;

  const updated = await userRepository.updateById(userId, {
    ...(input.firstName ? { firstName: input.firstName } : {}),
    ...(input.lastName ? { lastName: input.lastName } : {}),
    ...(input.roleIds ? { roles: input.roleIds as unknown as UserDocument["roles"] } : {}),
    ...(input.status ? { status: input.status } : {}),
    updatedBy: actorUserId as unknown as UserDocument["updatedBy"],
  });

  // If status is changing to BLOCKED/DISABLED, or roles changed, bump
  // tokenVersion so any currently-outstanding access token is immediately
  // invalidated (see requirement #16/#57 - no stale authorization caching).
  const statusBecameRestrictive =
    input.status && input.status !== previousStatus && (input.status === "BLOCKED" || input.status === "DISABLED");
  if (statusBecameRestrictive || input.roleIds) {
    await userRepository.incrementTokenVersion(userId);
  }
  if (input.status || input.roleIds) {
    await userRepository.incrementPermissionVersion(userId);
  }

  await auditLogRepository.record({
    actorUserId,
    targetUserId: userId,
    action: input.status && input.status !== previousStatus ? `USER_STATUS_CHANGED_${input.status}` : "USER_UPDATED",
    entityType: "User",
    entityId: userId,
    metadata: { previousStatus, newStatus: input.status },
  });

  // Distinct audit entries for role assignment changes (requirement #35
  // lists "role assigned" / "role removed" separately from a generic
  // user-updated event).
  if (input.roleIds) {
    const nextRoleIds = input.roleIds;
    const added = nextRoleIds.filter((id) => !previousRoleIds.includes(id));
    const removed = previousRoleIds.filter((id) => !nextRoleIds.includes(id));

    if (added.length > 0) {
      await auditLogRepository.record({
        actorUserId,
        targetUserId: userId,
        action: "ROLE_ASSIGNED",
        entityType: "User",
        entityId: userId,
        metadata: { roleIds: added },
      });
    }
    if (removed.length > 0) {
      await auditLogRepository.record({
        actorUserId,
        targetUserId: userId,
        action: "ROLE_REMOVED",
        entityType: "User",
        entityId: userId,
        metadata: { roleIds: removed },
      });
    }
  }

  return updated;
}

/**
 * Sets a target user's per-user permission overrides (requirement #9) -
 * SUPER_ADMIN -> ADMIN, or COMPANY_ADMIN -> its own MODERATOR. Every granted
 * (true) entry is individually validated by canGrantPermissionOverride();
 * this is where privilege escalation is actually prevented, not just at the
 * route boundary.
 */
export async function setUserPermissionOverrides(
  targetUserId: string,
  overrides: PermissionMap,
  access: ResolvedAccess
) {
  const target = await userRepository.findById(targetUserId);
  if (!target) throw new NotFoundError("User not found.");

  const actorUserId = String(access.user._id);
  const targetLayer = target.userLayer as UserLayer;
  const targetManagedBy = target.managedBy ? String(target.managedBy) : null;

  if (
    !canManageTargetUser({
      actorUserId,
      actorLayer: access.userLayer,
      isSuperAdmin: access.isSuperAdmin,
      targetUserId,
      targetLayer,
      targetManagedBy,
    })
  ) {
    throw new AuthorizationError("You do not have authority to manage this user.");
  }

  for (const [resource, actions] of Object.entries(overrides)) {
    for (const [action, granted] of Object.entries(actions)) {
      if (!granted) continue;
      const allowed = canGrantPermissionOverride({
        actorUserId,
        actorLayer: access.userLayer,
        actorEffectivePermissions: access.permissions,
        isSuperAdmin: access.isSuperAdmin,
        targetUserId,
        targetLayer,
        targetManagedBy,
        resource,
        action: action as PermissionAction,
      });
      if (!allowed) {
        throw new AuthorizationError(`You are not permitted to grant '${action}' on '${resource}'.`);
      }
    }
  }

  const updated = await userRepository.updatePermissionOverrides(
    targetUserId,
    overrides as Record<string, Record<string, boolean>>
  );
  // Takes effect immediately, same as a role change (see updateUser above).
  await userRepository.incrementTokenVersion(targetUserId);
  await userRepository.incrementPermissionVersion(targetUserId);

  await auditLogRepository.record({
    actorUserId,
    targetUserId,
    action: "USER_PERMISSIONS_ASSIGNED",
    entityType: "User",
    entityId: targetUserId,
    metadata: { overrides },
  });

  return updated;
}

/**
 * Whether `layer` is one the actor is allowed to view at all - reused so the
 * layer-tabbed management area's `?userLayer=` filter can never widen what
 * buildUserListScopeFilter() already scoped the actor to.
 */
function isLayerVisibleToActor(layer: UserLayer, access: ResolvedAccess): boolean {
  if (access.isSuperAdmin) return true;
  return (VIEWABLE_TARGET_LAYERS_BY[access.userLayer] ?? []).includes(layer);
}

export async function listUsers(
  params: { page: number; limit: number; search?: string; userLayer?: UserLayer },
  access: ResolvedAccess
) {
  const scopeFilter = buildUserListScopeFilter(access);
  if (params.userLayer) {
    // An out-of-scope layer request matches nothing rather than erroring -
    // same "fail closed" shape buildUserListScopeFilter() already uses for
    // an actor with zero manageable layers.
    scopeFilter.userLayer = isLayerVisibleToActor(params.userLayer, access) ? params.userLayer : { $in: [] };
  }
  const { items, total } = await userRepository.list({ ...params, scopeFilter });
  return {
    items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
      hasNextPage: params.page * params.limit < total,
      hasPreviousPage: params.page > 1,
    },
  };
}
