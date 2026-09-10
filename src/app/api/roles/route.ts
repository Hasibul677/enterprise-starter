import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requirePermission, requireAnyAdminAreaAccess } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { roleCreateSchema } from "@/features/roles/schemas/role-create.schema";
import { createRole, listRolesForActor } from "@/services/role.service";
import { ok, created, handleRouteError } from "@/lib/api/response";
import { requireCsrf } from "@/lib/security/csrf";

export async function GET() {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    // Read-only role/permission overview can be shown to a permitted ADMIN
    // (requirement #17 "role/permission overview") or a COMPANY_ADMIN
    // managing its own moderator roles (requirement #6); fine-grained
    // ownership scoping happens inside listRolesForActor().
    requireAnyAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.ROLES, "view");

    const roles = await listRolesForActor(access);
    return ok(roles, { code: "ROLES_FETCHED", message: "Roles fetched successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    await requireCsrf(request);
    const access = await resolveCurrentAccess();
    // Route proves the actor belongs in SOME admin-capable area at all;
    // createRole() enforces exactly which layer they may target (SUPER_ADMIN
    // -> ADMIN/COMPANY_ADMIN/CUSTOMER, COMPANY_ADMIN -> MODERATOR only,
    // requirement #3/#4/#7).
    requireAnyAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.ROLES, "add");

    const body = await request.json();
    const input = roleCreateSchema.parse(body);
    const role = await createRole(input, access);

    return created({ role }, "ROLE_CREATED", "Role created successfully.");
  } catch (err) {
    return handleRouteError(err);
  }
}
