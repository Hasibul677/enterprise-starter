import { roleRepository } from "@/repositories/role.repository";
import { UserModel } from "@/models/user.model";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors/app-error";
import { SUPER_ADMIN_ROLE_SLUG } from "@/lib/permissions/constants";
import type { RoleCreateInput } from "@/features/roles/schemas/role-create.schema";
import type { RoleUpdateInput } from "@/features/roles/schemas/role-update.schema";
import type { RoleDocument } from "@/models/role.model";

/**
 * A role that is currently assigned to one or more users (active or not -
 * deactivating the role would silently strip those users of everything it
 * grants, with no explicit reassignment) can never be deactivated. This is
 * checked independently of the isSystem guard, so it also protects custom
 * roles created through the Roles admin UI, not just the 5 fixed hierarchy
 * roles.
 */
async function assertRoleHasNoAssignedUsers(roleId: string, roleName: string) {
  const assignedCount = await UserModel.countDocuments({ roles: roleId });
  if (assignedCount > 0) {
    throw new ValidationError(
      `Cannot deactivate or delete the '${roleName}' role - it is still assigned to ${assignedCount} user(s).`,
      [{ field: "isActive", message: "Reassign every user holding this role to a different role first." }]
    );
  }
}

export async function createRole(input: RoleCreateInput, actorUserId: string) {
  const existing = await roleRepository.findBySlug(input.slug);
  if (existing) throw new ConflictError("A role with this slug already exists.");

  const role = await roleRepository.create({
    ...input,
    createdBy: actorUserId,
  } as unknown as Partial<RoleDocument>);

  await auditLogRepository.record({
    actorUserId,
    action: "ROLE_CREATED",
    entityType: "Role",
    entityId: String(role._id),
  });

  return role;
}

export async function updateRole(roleId: string, input: RoleUpdateInput, actorUserId: string) {
  const role = await roleRepository.findById(roleId);
  if (!role) throw new NotFoundError("Role not found.");

  if (input.isActive === false) {
    if (role.isSystem) {
      throw new ValidationError("System roles cannot be deactivated.", [
        { field: "isActive", message: "This is a protected system role." },
      ]);
    }
    await assertRoleHasNoAssignedUsers(roleId, role.name);
  }

  const updated = await roleRepository.updateById(roleId, {
    ...input,
    updatedBy: actorUserId,
  } as unknown as Partial<RoleDocument>);

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
 * Prevents deleting/deactivating a built-in system role, a role that is
 * still assigned to any user, or the last viable path to Super Admin access
 * (requirement #10/#33).
 */
export async function deactivateRole(roleId: string, actorUserId: string) {
  const role = await roleRepository.findById(roleId);
  if (!role) throw new NotFoundError("Role not found.");

  if (role.isSystem) {
    throw new ValidationError("System roles cannot be deleted or deactivated.");
  }

  await assertRoleHasNoAssignedUsers(roleId, role.name);

  if (role.slug === SUPER_ADMIN_ROLE_SLUG) {
    const otherActiveSuperAdmins = await UserModel.countDocuments({ roles: role._id, status: "ACTIVE" });
    if (otherActiveSuperAdmins <= 1) {
      throw new ValidationError("Cannot remove the last active Super Admin access path.");
    }
  }

  const updated = await roleRepository.deactivateById(roleId);

  await auditLogRepository.record({
    actorUserId,
    action: "ROLE_DEACTIVATED",
    entityType: "Role",
    entityId: roleId,
  });

  return updated;
}

export async function listRoles() {
  return roleRepository.list();
}
