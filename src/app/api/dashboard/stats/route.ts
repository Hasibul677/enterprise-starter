import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requireAdminAreaAccess, requirePermission } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { getUserStatsSummary } from "@/services/dashboard.service";
import { ok, handleRouteError } from "@/lib/api/response";

/**
 * Backs the SUPER_ADMIN/ADMIN dashboard's stat cards + charts. Admin-area
 * only (not Company Admin/Moderator - this dashboard is SUPER_ADMIN/ADMIN
 * per the feature request), and getUserStatsSummary() scopes every number
 * through the exact same RBAC filter /api/users already uses - an ADMIN can
 * never receive a Super Admin/Admin-layer count here.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.DASHBOARD, "view");

    const stats = await getUserStatsSummary(access);
    return ok(stats, { code: "DASHBOARD_STATS_FETCHED", message: "Dashboard stats fetched successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}
