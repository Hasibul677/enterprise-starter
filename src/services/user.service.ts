import { userRepository } from "@/repositories/user.repository";
import { roleRepository } from "@/repositories/role.repository";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { UserModel } from "@/models/user.model";
import { hashPassword, isPasswordStrongEnough } from "@/lib/security/password";
import { ValidationError, NotFoundError, ConflictError, AuthorizationError } from "@/lib/errors/app-error";
import { ROLE_SLUGS } from "@/lib/permissions/constants";
import {
  canAssignRole,
  canGrantPermissionOverride,
  canManageTargetUser,
  getRoleSlugs,
  MANAGEABLE_TARGET_ROLES_BY,
} from "@/lib/permissions/role-hierarchy";
import type { ResolvedAccess } from "@/lib/auth/current-user";
import type { UserCreateInput } from "@/features/users/schemas/user-create.schema";
import type { UserUpdateInput } from "@/features/users/schemas/user-update.schema";
import type { PermissionAction, PermissionMap } from "@/lib/permissions/constants";
import type { UserDocument } from "@/models/user.model";

/**
 * Every route in this file already passed requireAdminAreaAccess() or
 * requireNormalAdminAreaAccess() (the actor belongs in SOME admin-capable
 * dashboard) plus requirePermission(USERS, ...) (the actor can act on users
 * AT ALL). Everything below is the finer-grained hierarchy authority those
 * two checks can't express on their own: who specifically the actor is
 * allowed to create/view/edit, per role-hierarchy.ts (requirement #3/#8/#10).
 */

function targetSlugsOf(user: { roles?: unknown }): ReturnType<typeof getRoleSlugs> {
  return getRoleSlugs((user.roles ?? []) as unknown as { slug: string; isActive: boolean }[]);
}

/**
 * An inactive role contributes nothing (mergeRolePermissions() skips it),
 * so assigning one to a user would silently create a role reference that
 * does nothing - reject it outright rather than let it happen quietly.
 * Combined with role.service.ts's "can't deactivate a role that's still
 * assigned" guard, a role can never legitimately be both inactive AND held
 * by a user going forward.
 */
function assertRolesActive(roles: { slug: string; isActive: boolean }[]) {
  const inactive = roles.filter((r) => !r.isActive);
  if (inactive.length > 0) {
    throw new ValidationError("One or more roles are inactive and cannot be assigned.", [
      { field: "roleIds", message: `Inactive role(s): ${inactive.map((r) => r.slug).join(", ")}.` },
    ]);
  }
}

async function buildUserListScopeFilter(access: ResolvedAccess): Promise<Record<string, unknown>> {
  if (access.isSuperAdmin) return {};

  const manageableSlugs = Array.from(new Set(access.roleSlugs.flatMap((slug) => MANAGEABLE_TARGET_ROLES_BY[slug] ?? [])));
  if (manageableSlugs.length === 0) {
    return { _id: { $in: [] } }; // no manageable roles - matches nothing
  }

  const roles = await roleRepository.findBySlugs(manageableSlugs);
  const filter: Record<string, unknown> = { roles: { $in: roles.map((r) => r._id) } };

  // NORMAL_ADMIN only ever manages its OWN moderators (requirement #10) -
  // ADMIN has no equivalent ownership restriction over CUSTOMER accounts.
  if (access.roleSlugs.includes(ROLE_SLUGS.NORMAL_ADMIN)) {
    filter.managedBy = String(access.user._id);
  }

  return filter;
}

/**
 * Fetches a single user for an admin-area/normal-admin-area viewer,
 * enforcing the same target-management authority as updateUser() so a
 * NORMAL_ADMIN (etc.) can't read another actor's users by guessing an id
 * even though the list endpoint already scopes correctly (requirement #10).
 */
export async function getUserForActor(userId: string, access: ResolvedAccess) {
  const target = await userRepository.findById(userId);
  if (!target) throw new NotFoundError("User not found.");

  if (!access.isSuperAdmin) {
    const authorized =
      String(access.user._id) === userId ||
      canManageTargetUser({
        actorUserId: String(access.user._id),
        actorSlugs: access.roleSlugs,
        isSuperAdmin: access.isSuperAdmin,
        targetUserId: userId,
        targetSlugs: targetSlugsOf(target),
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
    throw new ValidationError("One or more role IDs are invalid.", [{ field: "roleIds", message: "Invalid role reference." }]);
  }
  assertRolesActive(roles);

  const actorUserId = String(access.user._id);
  const requestedSlugs = roles.map((r) => r.slug);
  for (const slug of requestedSlugs) {
    if (!canAssignRole(access.roleSlugs, slug)) {
      throw new AuthorizationError(`You are not authorized to create a user with the '${slug}' role.`);
    }
  }

  // Ownership: a MODERATOR created here is always created by its NORMAL_ADMIN
  // (the only actor canAssignRole() ever lets request the MODERATOR role).
  const managedBy = requestedSlugs.includes(ROLE_SLUGS.MODERATOR) ? actorUserId : null;

  const passwordHash = await hashPassword(input.password);
  const user = await userRepository.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    passwordHash,
    roles: input.roleIds as unknown as UserDocument["roles"],
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
  });

  return user;
}

export async function updateUser(userId: string, input: UserUpdateInput, access: ResolvedAccess) {
  const target = await userRepository.findById(userId);
  if (!target) throw new NotFoundError("User not found.");

  const actorUserId = String(access.user._id);
  const targetSlugs = targetSlugsOf(target);
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
        actorSlugs: access.roleSlugs,
        isSuperAdmin: access.isSuperAdmin,
        targetUserId: userId,
        targetSlugs,
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
      throw new ValidationError("One or more role IDs are invalid.", [{ field: "roleIds", message: "Invalid role reference." }]);
    }
    assertRolesActive(roles);

    // Only NEWLY added roles need assignment authority (requirement #8/#9) -
    // keeping or removing a role the target already holds isn't a "grant".
    // This matters in practice: a Super Admin can always REACH any user
    // (requirement #2), including an existing MODERATOR, but
    // canAssignRole() (see its own doc comment) deliberately excludes
    // MODERATOR from even Super Admin's assignable set - re-validating
    // every unchanged role on every edit would wrongly block a Super Admin
    // from e.g. just changing that Moderator's status.
    const addedRoleIds = new Set(input.roleIds.filter((id) => !previousRoleIds.includes(id)));
    for (const role of roles) {
      if (addedRoleIds.has(String(role._id)) && !canAssignRole(access.roleSlugs, role.slug)) {
        throw new AuthorizationError(`You are not authorized to assign the '${role.slug}' role.`);
      }
    }

    // Requirement #10/#33 - never let the last active Super Admin's access
    // path disappear, even via a per-user role edit rather than deactivating
    // the role itself (see role.service.ts#deactivateRole for the
    // equivalent guard on the role side).
    const targetHadSuperAdmin = targetSlugs.includes(ROLE_SLUGS.SUPER_ADMIN);
    const newSlugs = roles.map((r) => r.slug);
    if (targetHadSuperAdmin && !newSlugs.includes(ROLE_SLUGS.SUPER_ADMIN)) {
      const superAdminRoleId = ((target.roles ?? []) as unknown as { slug: string; _id: unknown }[]).find(
        (r) => r.slug === ROLE_SLUGS.SUPER_ADMIN
      )?._id;
      const otherActiveSuperAdmins = await UserModel.countDocuments({
        roles: superAdminRoleId,
        status: "ACTIVE",
        _id: { $ne: userId },
      });
      if (otherActiveSuperAdmins < 1) {
        throw new ValidationError("Cannot remove the Super Admin role from the last active Super Admin.");
      }
    }
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
  const statusBecameRestrictive = input.status && input.status !== previousStatus && (input.status === "BLOCKED" || input.status === "DISABLED");
  if (statusBecameRestrictive || input.roleIds) {
    await userRepository.incrementTokenVersion(userId);
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
 * SUPER_ADMIN -> ADMIN, or NORMAL_ADMIN -> its own MODERATOR. Every granted
 * (true) entry is individually validated by canGrantPermissionOverride();
 * this is where privilege escalation is actually prevented, not just at the
 * route boundary.
 */
export async function setUserPermissionOverrides(targetUserId: string, overrides: PermissionMap, access: ResolvedAccess) {
  const target = await userRepository.findById(targetUserId);
  if (!target) throw new NotFoundError("User not found.");

  const actorUserId = String(access.user._id);
  const targetSlugs = targetSlugsOf(target);
  const targetManagedBy = target.managedBy ? String(target.managedBy) : null;

  if (
    !canManageTargetUser({
      actorUserId,
      actorSlugs: access.roleSlugs,
      isSuperAdmin: access.isSuperAdmin,
      targetUserId,
      targetSlugs,
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
        actorSlugs: access.roleSlugs,
        actorEffectivePermissions: access.permissions,
        isSuperAdmin: access.isSuperAdmin,
        targetUserId,
        targetSlugs,
        targetManagedBy,
        resource,
        action: action as PermissionAction,
      });
      if (!allowed) {
        throw new AuthorizationError(`You are not permitted to grant '${action}' on '${resource}'.`);
      }
    }
  }

  const updated = await userRepository.updatePermissionOverrides(targetUserId, overrides as Record<string, Record<string, boolean>>);
  // Takes effect immediately, same as a role change (see updateUser above).
  await userRepository.incrementTokenVersion(targetUserId);

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

export async function listUsers(params: { page: number; limit: number; search?: string }, access: ResolvedAccess) {
  const scopeFilter = await buildUserListScopeFilter(access);
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
