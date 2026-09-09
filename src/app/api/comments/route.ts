import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requirePermission, requireCompanyAdminAreaAccess } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { ok, handleRouteError } from "@/lib/api/response";

/**
 * Thin stub proving the COMMENTS resource (part of the COMPANY_ADMIN/
 * MODERATOR menu scope example in requirement #7) is enforced server-side.
 * A real deployment would back this with a Comment model/repository/service
 * following the same layered pattern as Users/Roles/Menus - out of scope
 * here since the base app has no comment-bearing content yet.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireCompanyAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.COMMENTS, "view");

    return ok({ items: [] });
  } catch (err) {
    return handleRouteError(err);
  }
}
