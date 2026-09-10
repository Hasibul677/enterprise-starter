import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { endImpersonation } from "@/lib/auth/auth-service";
import { setAuthCookies } from "@/lib/security/cookies";
import { generateCsrfToken, requireCsrf } from "@/lib/security/csrf";
import { getEnv } from "@/config/env";
import { durationToSeconds } from "@/lib/date/duration-seconds";
import { ok, handleRouteError } from "@/lib/api/response";

/**
 * Requirement #21 "Return to Super Admin". Deliberately NOT gated by
 * requireSuperAdmin() - the whole point is that the CURRENT session is the
 * impersonated target, not a Super Admin. Authorization instead comes from
 * endImpersonation() verifying the session's own signed `impersonatedBy`
 * claim points at a still-valid, still-active Super Admin account - no
 * password re-entry needed.
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    await requireCsrf(request);
    const access = await resolveCurrentAccess();

    const { accessToken, refreshToken, redirectTo } = await endImpersonation({ access });

    const env = getEnv();
    const csrfToken = generateCsrfToken();
    await setAuthCookies({
      accessToken,
      refreshToken,
      csrfToken,
      accessMaxAgeSeconds: durationToSeconds(env.ACCESS_TOKEN_EXPIRES_IN),
      refreshMaxAgeSeconds: durationToSeconds(env.REFRESH_TOKEN_EXPIRES_IN),
    });

    return ok({ redirectTo }, { code: "IMPERSONATION_ENDED", message: "Returned to your account." });
  } catch (err) {
    return handleRouteError(err);
  }
}
