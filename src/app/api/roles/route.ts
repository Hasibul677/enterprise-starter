import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requirePermission, requireSuperAdmin } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { roleCreateSchema } from "@/features/roles/schemas/role-create.schema";
import { createRole, listRoles } from "@/services/role.service";
import { ok, created, handleRouteError } from "@/lib/api/response";

export async function GET() {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireSuperAdmin(access);
    requirePermission(access, CORE_RESOURCES.ROLES, "view");

    const roles = await listRoles();
    return ok(roles, { code: "ROLES_FETCHED", message: "Roles fetched successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireSuperAdmin(access);
    requirePermission(access, CORE_RESOURCES.ROLES, "add");

    const body = await request.json();
    const input = roleCreateSchema.parse(body);
    const role = await createRole(input, String(access.user._id));

    return created({ role }, "ROLE_CREATED", "Role created successfully.");
  } catch (err) {
    return handleRouteError(err);
  }
}
