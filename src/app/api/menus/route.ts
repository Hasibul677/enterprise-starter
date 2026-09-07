import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requirePermission, requireSuperAdmin } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { menuCreateSchema } from "@/features/menus/schemas/menu-create.schema";
import { createMenu, listMenus } from "@/services/menu.service";
import { ok, created, handleRouteError } from "@/lib/api/response";

export async function GET() {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireSuperAdmin(access);
    requirePermission(access, CORE_RESOURCES.MENUS, "view");

    const menus = await listMenus();
    return ok(menus, { code: "MENUS_FETCHED", message: "Menus fetched successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireSuperAdmin(access);
    requirePermission(access, CORE_RESOURCES.MENUS, "add");

    const body = await request.json();
    const input = menuCreateSchema.parse(body);
    const menu = await createMenu(input, String(access.user._id));

    return created({ menu }, "MENU_CREATED", "Menu created successfully.");
  } catch (err) {
    return handleRouteError(err);
  }
}
