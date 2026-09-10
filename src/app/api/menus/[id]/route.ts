import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requirePermission, requireAdminAreaAccess } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { menuUpdateSchema } from "@/features/menus/schemas/menu-update.schema";
import { updateMenu, deactivateMenu } from "@/services/menu.service";
import { menuRepository } from "@/repositories/menu.repository";
import { ok, handleRouteError } from "@/lib/api/response";
import { parseObjectId } from "@/lib/validation/object-id";
import { NotFoundError } from "@/lib/errors/app-error";
import { requireCsrf } from "@/lib/security/csrf";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.MENUS, "view");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    const menu = await menuRepository.findById(id);
    if (!menu) throw new NotFoundError("Menu not found.");

    return ok({ menu });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    await requireCsrf(request);
    const access = await resolveCurrentAccess();
    requireAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.MENUS, "edit");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    const body = await request.json();
    const input = menuUpdateSchema.parse(body);
    const menu = await updateMenu(id, input, String(access.user._id));

    return ok({ menu }, { code: "MENU_UPDATED", message: "Menu updated successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    await requireCsrf(request);
    const access = await resolveCurrentAccess();
    requireAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.MENUS, "delete");

    const { id: rawId } = await params;
    const id = parseObjectId(rawId);
    const menu = await deactivateMenu(id, String(access.user._id));

    return ok({ menu }, { code: "MENU_DEACTIVATED", message: "Menu deactivated successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}
