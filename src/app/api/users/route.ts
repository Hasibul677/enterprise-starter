import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requirePermission, requireSuperAdmin } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { userCreateSchema } from "@/features/users/schemas/user-create.schema";
import { userListQuerySchema } from "@/features/users/schemas/user-update.schema";
import { adminCreateUser, listUsers } from "@/services/user.service";
import { ok, created, handleRouteError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireSuperAdmin(access);
    requirePermission(access, CORE_RESOURCES.USERS, "view");

    const { searchParams } = new URL(request.url);
    const query = userListQuerySchema.parse(Object.fromEntries(searchParams));
    const { items, pagination } = await listUsers(query);

    return ok(items, { code: "USERS_FETCHED", message: "Users fetched successfully.", meta: { pagination } });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    // Example of requirement #13 in practice: users.view = true, users.add = false -> 403 here.
    requireSuperAdmin(access);
    requirePermission(access, CORE_RESOURCES.USERS, "add");

    const body = await request.json();
    const input = userCreateSchema.parse(body);
    const user = await adminCreateUser(input, String(access.user._id));

    return created({ user }, "USER_CREATED", "User created successfully.");
  } catch (err) {
    return handleRouteError(err);
  }
}
