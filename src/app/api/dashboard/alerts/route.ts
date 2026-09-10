import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requireAdminAreaAccess, requirePermission } from "@/lib/permissions/guard";
import { CORE_RESOURCES } from "@/lib/permissions/constants";
import { getSecurityAlerts } from "@/services/dashboard.service";
import { ok, handleRouteError } from "@/lib/api/response";

/**
 * "System Alerts" widget - a real, RBAC-scoped read over AuditLogModel,
 * narrowed to the fixed set of security-relevant action types (see
 * dashboard.service.ts#getSecurityAlerts / classifyAlertSeverity). Same
 * gate as /api/dashboard/stats.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const access = await resolveCurrentAccess();
    requireAdminAreaAccess(access);
    requirePermission(access, CORE_RESOURCES.DASHBOARD, "view");

    const alerts = await getSecurityAlerts(access);
    return ok(alerts, { code: "DASHBOARD_ALERTS_FETCHED", message: "Security alerts fetched successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}
