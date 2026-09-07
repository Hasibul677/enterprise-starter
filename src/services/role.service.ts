import { roleRepository } from "@/repositories/role.repository";
import { UserModel } from "@/models/user.model";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors/app-error";
import { SUPER_ADMIN_ROLE_SLUG } from "@/lib/permissions/constants";
import type { RoleCreateInput } from "@/features/roles/schemas/role-create.schema";
import type { RoleUpdateInput } from "@/features/roles/schemas/role-update.schema";
import type { RoleDocument } from "@/models/role.model";

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

  if (role.isSystem && input.isActive === false) {
    throw new ValidationError("System roles cannot be deactivated.", [
      { field: "isActive", message: "This is a protected system role." },
    ]);
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
 * Prevents both accidental deletion of built-in system roles AND removing
 * the last viable path to Super Admin access (requirement #10/#33).
 */
export async function deactivateRole(roleId: string, actorUserId: string) {
  const role = await roleRepository.findById(roleId);
  if (!role) throw new NotFoundError("Role not found.");

  if (role.isSystem) {
    throw new ValidationError("System roles cannot be deleted or deactivated.");
  }

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
