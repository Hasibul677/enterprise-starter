import { userRepository } from "@/repositories/user.repository";
import { roleRepository } from "@/repositories/role.repository";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { hashPassword, isPasswordStrongEnough } from "@/lib/security/password";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors/app-error";
import type { UserCreateInput } from "@/features/users/schemas/user-create.schema";
import type { UserUpdateInput } from "@/features/users/schemas/user-update.schema";
import type { UserDocument } from "@/models/user.model";

/** Admin-initiated user creation - explicitly allows setting roles/status, unlike public registration. */
export async function adminCreateUser(input: UserCreateInput, actorUserId: string) {
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

  const passwordHash = await hashPassword(input.password);
  const user = await userRepository.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    passwordHash,
    roles: input.roleIds as unknown as UserDocument["roles"],
    status: input.status,
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

export async function updateUser(userId: string, input: UserUpdateInput, actorUserId: string) {
  const target = await userRepository.findById(userId);
  if (!target) throw new NotFoundError("User not found.");

  if (input.roleIds) {
    const roles = await roleRepository.findByIds(input.roleIds);
    if (roles.length !== input.roleIds.length) {
      throw new ValidationError("One or more role IDs are invalid.", [{ field: "roleIds", message: "Invalid role reference." }]);
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
    const previousRoleIds = ((target.roles ?? []) as unknown as { _id: unknown }[]).map((r) => String(r._id ?? r));
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

export async function listUsers(params: { page: number; limit: number; search?: string }) {
  const { items, total } = await userRepository.list(params);
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
