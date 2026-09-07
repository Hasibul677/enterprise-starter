import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { listMenus } from "@/services/menu.service";
import { buildEffectiveMenuTree } from "@/lib/menu/menu-service";
import { ok, handleRouteError } from "@/lib/api/response";

/**
 * Returns the fully-resolved "who am I / what can I do / what do I see"
 * bundle (requirement #16), computed fresh from the DB on every call.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    const allMenus = await listMenus();
    const menuTree = buildEffectiveMenuTree(allMenus, access.permissions, access.isSuperAdmin);

    return ok({
      user: access.user,
      roles: access.roles,
      permissions: access.permissions,
      isSuperAdmin: access.isSuperAdmin,
      menus: menuTree,
      warning: access.user.status === "WARNING",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
