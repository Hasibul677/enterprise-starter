import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { revokeAllSessionsForUser } from "@/lib/auth/session-service";
import { clearAuthCookies } from "@/lib/security/cookies";
import { requireCsrf } from "@/lib/security/csrf";
import { ok, handleRouteError } from "@/lib/api/response";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { userRepository } from "@/repositories/user.repository";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    await requireCsrf(request);

    const access = await resolveCurrentAccess();
    const userId = String(access.user._id);
    await revokeAllSessionsForUser(userId, "LOGOUT_ALL");
    // Bump tokenVersion too, so any access token minted under the old
    // sessions is invalidated even before its 30-minute expiry.
    await userRepository.incrementTokenVersion(userId);
    await clearAuthCookies();

    await auditLogRepository.record({
      actorUserId: userId,
      action: "USER_LOGOUT_ALL",
      entityType: "User",
      entityId: userId,
    });

    return ok({ loggedOut: true }, { code: "LOGGED_OUT_ALL", message: "Logged out of all sessions." });
  } catch (err) {
    return handleRouteError(err);
  }
}
