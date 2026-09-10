import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { requireImpersonationActor } from "@/lib/permissions/guard";
import { impersonateUser } from "@/lib/auth/auth-service";
import { impersonateSchema } from "@/features/auth/schemas/impersonate.schema";
import { setAuthCookies } from "@/lib/security/cookies";
import { generateCsrfToken, requireCsrf } from "@/lib/security/csrf";
import { getEnv } from "@/config/env";
import { durationToSeconds } from "@/lib/date/duration-seconds";
import { ok, fail, handleRouteError } from "@/lib/api/response";
import { getRateLimiter, rateLimitKeyFromRequest } from "@/lib/security/rate-limit";

/**
 * Requirement #21 - "Login as User", extended to Company Admin account-
 * access over its own Moderators, and to a permission-gated Admin account-
 * access over its own Customers. requireImpersonationActor() is the real,
 * DB-derived gate on WHO may start an impersonation at all (Super Admin,
 * Company Admin, or an Admin holding the `impersonation` permission - never
 * trust a client-side role/permission check); per-target eligibility (layer,
 * ownership, active status) is independently enforced inside
 * impersonateUser(). Overwrites the CURRENT browser's auth cookies
 * with a real session/token pair for the target user, exactly like a normal
 * login (setAuthCookies() is the same helper the login route uses) - the
 * resulting session is server-authorized and enforced by the existing auth/
 * permission/menu/route-protection pipeline unchanged, never a client-side
 * shortcut.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimit = await getRateLimiter("impersonate").consume(
      rateLimitKeyFromRequest(request, "impersonate", getEnv().TRUSTED_PROXY_HOPS)
    );
    if (!rateLimit.allowed) {
      return fail(429, "RATE_LIMITED", "Too many impersonation attempts. Please try again later.");
    }

    await connectToDatabase();
    await requireCsrf(request);
    const access = await resolveCurrentAccess();
    requireImpersonationActor(access);

    const body = await request.json();
    const input = impersonateSchema.parse(body);

    const { accessToken, refreshToken, redirectTo, target } = await impersonateUser({
      targetUserId: input.targetUserId,
      access,
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    const env = getEnv();
    const csrfToken = generateCsrfToken();
    await setAuthCookies({
      accessToken,
      refreshToken,
      csrfToken,
      accessMaxAgeSeconds: durationToSeconds(env.ACCESS_TOKEN_EXPIRES_IN),
      refreshMaxAgeSeconds: durationToSeconds(env.REFRESH_TOKEN_EXPIRES_IN),
    });

    return ok(
      { redirectTo, target: { firstName: target.firstName, lastName: target.lastName, email: target.email } },
      { code: "IMPERSONATION_STARTED", message: "Impersonation session started." }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
