import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requirePermission, requireAnyAdminAreaAccess } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { roleUpdateSchema } from "@/features/roles/schemas/role-update.schema";
import { updateRole, deactivateRole, getRoleForViewer } from "@/services/role.service";
import { ok, handleRouteError } from "@/lib/api/response";
import { parseObjectId } from "@/lib/validation/object-id";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireAnyAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.ROLES, "view");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    // getRoleForViewer() enforces canViewRole() - same ownership scope as
    // listRolesForActor(), so a COMPANY_ADMIN can't fetch another company's
    // role by guessing/manipulating its id.
    const role = await getRoleForViewer(id, access);

    return ok({ role });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    // Route proves the actor belongs in SOME admin-capable area; updateRole()
    // enforces canManageRole() (SUPER_ADMIN, or the owning COMPANY_ADMIN).
    requireAnyAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.ROLES, "edit");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    const body = await request.json();
    const input = roleUpdateSchema.parse(body);
    const role = await updateRole(id, input, access);

    return ok({ role }, { code: "ROLE_UPDATED", message: "Role updated successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireAnyAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.ROLES, "delete");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    const role = await deactivateRole(id, access);

    return ok({ role }, { code: "ROLE_DEACTIVATED", message: "Role deactivated successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}
