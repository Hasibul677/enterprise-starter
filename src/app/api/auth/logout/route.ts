import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { revokeSession } from "@/lib/auth/session-service";
import { clearAuthCookies } from "@/lib/security/cookies";
import { verifyCsrf } from "@/lib/security/csrf";
import { cookies } from "next/headers";
import { CSRF_COOKIE } from "@/lib/security/cookies";
import { ok, handleRouteError, fail } from "@/lib/api/response";
import { auditLogRepository } from "@/repositories/audit-log.repository";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const csrfCookie = (await cookies()).get(CSRF_COOKIE)?.value;
    if (!verifyCsrf(request, csrfCookie)) {
      return fail(403, "CSRF_INVALID", "Invalid CSRF token.");
    }

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
