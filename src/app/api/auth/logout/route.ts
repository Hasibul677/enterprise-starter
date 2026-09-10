import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { revokeSession } from "@/lib/auth/session-service";
import { clearAuthCookies } from "@/lib/security/cookies";
import { requireCsrf } from "@/lib/security/csrf";
import { ok, handleRouteError } from "@/lib/api/response";
import { auditLogRepository } from "@/repositories/audit-log.repository";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    await requireCsrf(request);

    const access = await resolveCurrentAccess();
    await revokeSession(access.sessionId, "LOGOUT");
    await clearAuthCookies();

    await auditLogRepository.record({
      actorUserId: String(access.user._id),
      action: "USER_LOGOUT",
      entityType: "User",
      entityId: String(access.user._id),
    });

    return ok({ loggedOut: true }, { code: "LOGGED_OUT", message: "Logged out successfully." });
  } catch (err) {
    return handleRouteError(err);
  }
}
