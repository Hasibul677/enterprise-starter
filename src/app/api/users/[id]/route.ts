import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requirePermission, requireAnyAdminAreaAccess } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { userUpdateSchema } from "@/features/users/schemas/user-update.schema";
import { updateUser, getUserForViewer } from "@/services/user.service";
import { ok, handleRouteError } from "@/lib/api/response";
import { parseObjectId } from "@/lib/validation/object-id";
import { requireCsrf } from "@/lib/security/csrf";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireAnyAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.USERS, "view");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    const user = await getUserForViewer(id, access);

    return ok({ user });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    await requireCsrf(request);
    const access = await resolveCurrentAccess();
    requireAnyAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.USERS, "edit");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    const body = await request.json();
    const input = userUpdateSchema.parse(body);
    const user = await updateUser(id, input, access);

    return ok({ user }, { code: "USER_UPDATED", message: "User updated successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    await requireCsrf(request);
    const access = await resolveCurrentAccess();
    // Safe-deactivate rather than hard delete, preserving audit trail integrity.
    requireAnyAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.USERS, "delete");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    const user = await updateUser(id, { status: "DISABLED" }, access);

    return ok({ user }, { code: "USER_DEACTIVATED", message: "User deactivated successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}
