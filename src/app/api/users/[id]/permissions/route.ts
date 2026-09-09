import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requirePermission, requireAnyAdminAreaAccess } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { mergeRolePermissions } from "@/lib/permissions/merge";
import { userPermissionsUpdateSchema } from "@/features/users/schemas/user-permissions.schema";
import { getUserForActor, setUserPermissionOverrides } from "@/services/user.service";
import { ok, handleRouteError } from "@/lib/api/response";
import { parseObjectId } from "@/lib/validation/object-id";
import type { RoleDocument } from "@/models/role.model";

type Params = { params: Promise<{ id: string }> };

/**
 * Requirement #9: view/assign a single user's PER-USER permission
 * overrides - distinct from PATCH /api/roles/[id], which edits a role
 * DEFINITION shared by every user holding that role. Serves both the
 * SUPER_ADMIN -> ADMIN and COMPANY_ADMIN -> MODERATOR flows through the same
 * authority helpers (see role-hierarchy.ts).
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireAnyAdminAreaAccess(access);
    // Gated on PERMISSIONS ("permissions.view"), matching requirement #5's
    // granular permission list - SUPER_ADMIN and COMPANY_ADMIN hold it by
    // default (seed.ts) since assigning permissions is core to those layers;
    // exactly WHICH target/resource can actually be touched is enforced far
    // more narrowly below, in getUserForActor()/canManageTargetUser().
    requirePermission(access, CORE_RESOURCES.PERMISSIONS, "view");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    const user = await getUserForActor(id, access);

    const roles = (user.roles ?? []) as unknown as RoleDocument[];
    const rolePermissions = mergeRolePermissions(
      roles.map((r) => ({ isActive: r.isActive, permissions: Object.fromEntries(r.permissions as unknown as Map<string, never>) }))
    );
    const overrides = Object.fromEntries((user.permissionOverrides ?? new Map()) as unknown as Map<string, never>);

    return ok({ rolePermissions, overrides });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireAnyAdminAreaAccess(access);
    // "permissions.assign" (requirement #5) - reuses the "edit" action like
    // every other resource rather than inventing a 6th PermissionAction.
    requirePermission(access, CORE_RESOURCES.PERMISSIONS, "edit");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    const body = await request.json();
    const input = userPermissionsUpdateSchema.parse(body);
    const user = await setUserPermissionOverrides(id, input.permissions, access);

    return ok({ user }, { code: "USER_PERMISSIONS_UPDATED", message: "Permissions updated successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}
