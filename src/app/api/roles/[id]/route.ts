import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requirePermission, requireSuperAdmin } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { roleUpdateSchema } from "@/features/roles/schemas/role-update.schema";
import { updateRole, deactivateRole } from "@/services/role.service";
import { roleRepository } from "@/repositories/role.repository";
import { ok, handleRouteError } from "@/lib/api/response";
import { parseObjectId } from "@/lib/validation/object-id";
import { NotFoundError } from "@/lib/errors/app-error";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireSuperAdmin(access);
    requirePermission(access, CORE_RESOURCES.ROLES, "view");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    const role = await roleRepository.findById(id);
    if (!role) throw new NotFoundError("Role not found.");

    return ok({ role });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireSuperAdmin(access);
    requirePermission(access, CORE_RESOURCES.ROLES, "edit");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    const body = await request.json();
    const input = roleUpdateSchema.parse(body);
    const role = await updateRole(id, input, String(access.user._id));

    return ok({ role }, { code: "ROLE_UPDATED", message: "Role updated successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireSuperAdmin(access);
    requirePermission(access, CORE_RESOURCES.ROLES, "delete");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    const role = await deactivateRole(id, String(access.user._id));

    return ok({ role }, { code: "ROLE_DEACTIVATED", message: "Role deactivated successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}
