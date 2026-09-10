import { roleRepository } from "@/repositories/role.repository";
import { userRepository } from "@/repositories/user.repository";
import { UserModel } from "@/models/user.model";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { ValidationError, NotFoundError, ConflictError, AuthorizationError } from "@/lib/errors/app-error";
import { SUPER_ADMIN_ROLE_SLUG, USER_LAYERS } from "@/lib/permissions/constants";
import { CREATABLE_ROLE_LAYERS_BY, canManageRole, canViewRole } from "@/lib/permissions/role-hierarchy";
import type { ResolvedAccess } from "@/lib/auth/current-user";
import type { UserLayer } from "@/lib/permissions/constants";
import type { RoleCreateInput } from "@/features/roles/schemas/role-create.schema";
import type { RoleUpdateInput } from "@/features/roles/schemas/role-update.schema";
import type { RoleDocument } from "@/models/role.model";

function roleAuthorityFields(role: { userLayer: RoleDocument["userLayer"]; managedBy?: RoleDocument["managedBy"] }) {
  return { userLayer: role.userLayer as UserLayer, managedBy: role.managedBy ? String(role.managedBy) : null };
}

/**
 * SUPER_ADMIN creates roles targeting ADMIN/COMPANY_ADMIN/CUSTOMER; a
 * COMPANY_ADMIN creates roles targeting only MODERATOR, always scoped to
 * itself (requirement #3/#4/#7). The target layer is never trusted from
 * client input for a non-super-admin actor - it's forced to whatever
 * CREATABLE_ROLE_LAYERS_BY actually allows.
 */
export async function createRole(input: RoleCreateInput, access: ResolvedAccess) {
  const actorUserId = String(access.user._id);
  const actorLayer: UserLayer = access.isSuperAdmin ? USER_LAYERS.SUPER_ADMIN : access.userLayer;
  const allowedLayers = CREATABLE_ROLE_LAYERS_BY[actorLayer] ?? [];

  if (allowedLayers.length === 0) {
    throw new AuthorizationError("You are not authorized to create roles.");
  }

  const userLayer = access.isSuperAdmin ? input.userLayer : allowedLayers[0];
  if (!allowedLayers.includes(userLayer)) {
    throw new AuthorizationError(`You are not authorized to create a role targeting the '${userLayer}' layer.`);
  }
  const managedBy = access.isSuperAdmin ? null : actorUserId;

  const existing = await roleRepository.findBySlug(input.slug);
  if (existing) throw new ConflictError("A role with this slug already exists.");

  const role = await roleRepository.create({
    ...input,
    userLayer,
    managedBy: managedBy as unknown as RoleDocument["managedBy"],
    createdBy: actorUserId,
  } as unknown as Partial<RoleDocument>);

  await auditLogRepository.record({
    actorUserId,
    action: "ROLE_CREATED",
    entityType: "Role",
    entityId: String(role._id),
    metadata: { userLayer, managedBy },
  });

  return role;
}

/**
 * Fetches a single role with VIEW authority (canViewRole()) - same scope as
 * listRolesForActor(), so a COMPANY_ADMIN can't read a peer COMPANY_ADMIN's
 * custom role (permissions map, managedBy, isSystem) by guessing its id, even
 * though this route is otherwise a pure read with no write authority implied.
 */
export async function getRoleForViewer(roleId: string, access: ResolvedAccess) {
  const role = await roleRepository.findById(roleId);
  if (!role) throw new NotFoundError("Role not found.");

  if (
    !canViewRole({
      isSuperAdmin: access.isSuperAdmin,
      actorUserId: String(access.user._id),
      actorLayer: access.userLayer,
      role: roleAuthorityFields(role),
    })
  ) {
    throw new AuthorizationError("You do not have authority to view this role.");
  }

  return role;
}

export async function updateRole(roleId: string, input: RoleUpdateInput, access: ResolvedAccess) {
  const actorUserId = String(access.user._id);
  const role = await roleRepository.findById(roleId);
  if (!role) throw new NotFoundError("Role not found.");

  if (!canManageRole({ isSuperAdmin: access.isSuperAdmin, actorUserId, actorLayer: access.userLayer, role: roleAuthorityFields(role) })) {
    throw new AuthorizationError("You do not have authority to manage this role.");
  }

  if (input.isActive === false && role.isSystem) {
    throw new ValidationError("System roles cannot be deactivated.", [
      { field: "isActive", message: "This is a protected system role." },
    ]);
  }
  // Custom (non-system) roles may be deactivated even while assigned - the
  // live permission-sync (permissionVersion bump below + use-permission-
  // sync.ts) gracefully degrades any affected, logged-in user instead of
  // blocking the action. Only isSystem roles keep the absolute protection.

  const updated = await roleRepository.updateById(roleId, {
    ...input,
    updatedBy: actorUserId,
  } as unknown as Partial<RoleDocument>);

  // A role's permissions/active-state are shared by every user holding it -
  // bump each of their permissionVersion so an already-open tab detects the
  // change and refreshes its cached permissions/menus (see
  // use-permission-sync.ts). Unlike tokenVersion, this never forces logout.
  if (input.permissions || input.isActive !== undefined) {
    await userRepository.incrementPermissionVersionForRole(roleId);
  }

  await auditLogRepository.record({
    actorUserId,
    action: "ROLE_UPDATED",
    entityType: "Role",
    entityId: roleId,
    metadata: { permissionsChanged: Boolean(input.permissions) },
  });

  return updated;
}

/**
 * Prevents deleting/deactivating a built-in system role, or the last viable
 * path to Super Admin access (requirement #10/#33). Custom roles may be
 * deactivated even while assigned to users - see updateRole() above.
 */
export async function deactivateRole(roleId: string, access: ResolvedAccess) {
  const actorUserId = String(access.user._id);
  const role = await roleRepository.findById(roleId);
  if (!role) throw new NotFoundError("Role not found.");

  if (!canManageRole({ isSuperAdmin: access.isSuperAdmin, actorUserId, actorLayer: access.userLayer, role: roleAuthorityFields(role) })) {
    throw new AuthorizationError("You do not have authority to manage this role.");
  }

  // Checked BEFORE the blanket isSystem guard below so this specific
  // condition is actually reachable (and surfaces its own precise error)
  // rather than being permanently shadowed by isSystem - the seeded
  // SUPER_ADMIN role is always isSystem: true, so today isSystem alone
  // already blocks every deactivation of it unconditionally; this check
  // stays meaningful as its own safety net regardless of that.
  if (role.slug === SUPER_ADMIN_ROLE_SLUG) {
    const otherActiveSuperAdmins = await UserModel.countDocuments({ roles: role._id, status: "ACTIVE" });
    if (otherActiveSuperAdmins <= 1) {
      throw new ValidationError("Cannot remove the last active Super Admin access path.");
    }
  }

  if (role.isSystem) {
    throw new ValidationError("System roles cannot be deleted or deactivated.");
  }

  const updated = await roleRepository.deactivateById(roleId);
  await userRepository.incrementPermissionVersionForRole(roleId);

  await auditLogRepository.record({
    actorUserId,
    action: "ROLE_DEACTIVATED",
    entityType: "Role",
    entityId: roleId,
  });

  return updated;
}

/**
 * Requirement #6 - role ownership/scope. SUPER_ADMIN (and today's ADMIN
 * read-only Roles overview) sees every role; a COMPANY_ADMIN sees only the
 * shared MODERATOR-layer default(s) plus roles it created itself - never a
 * peer COMPANY_ADMIN's roles.
 */
export async function listRolesForActor(access: ResolvedAccess) {
  if (!access.isSuperAdmin && access.userLayer === USER_LAYERS.COMPANY_ADMIN) {
    return roleRepository.listForModeratorLayerOwner(String(access.user._id));
  }
  return roleRepository.list();
}
