import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requireAdminAreaAccess, requirePermission } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { getRecentActivity } from "@/services/dashboard.service";
import { ok, handleRouteError } from "@/lib/api/response";

/**
 * "Recent Activity" widget - a real, RBAC-scoped read over AuditLogModel
 * (see dashboard.service.ts#getRecentActivity / isAuditLogVisibleToActor).
 * Same gate as /api/dashboard/stats.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.DASHBOARD, "view");

    const activity = await getRecentActivity(access);
    return ok(activity, { code: "DASHBOARD_ACTIVITY_FETCHED", message: "Recent activity fetched successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}
