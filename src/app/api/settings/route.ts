import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requirePermission, requireAdminAreaAccess } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { ok, handleRouteError } from "@/lib/api/response";

/**
 * Thin stub proving the SETTINGS resource is enforced server-side, not just
 * hidden behind a sidebar link (requirement #4/#15). SUPER_ADMIN always
 * passes; ADMIN only passes if explicitly granted `settings.view` on their
 * role or as a per-user override (see seed.ts - ADMIN gets nothing here by
 * default, demonstrating "explicitly assigned", requirement #12).
 */
export async function GET() {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.SETTINGS, "view");

    return ok({ message: "System settings are managed here in a real deployment." });
  } catch (err) {
    return handleRouteError(err);
  }
}
