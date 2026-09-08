import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requirePermission, requireNormalAdminAreaAccess } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { ok, handleRouteError } from "@/lib/api/response";

/** Thin stub proving the REPORTS resource is enforced server-side - see comments/route.ts. */
export async function GET() {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireNormalAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.REPORTS, "view");

    return ok({ items: [] });
  } catch (err) {
    return handleRouteError(err);
  }
}
