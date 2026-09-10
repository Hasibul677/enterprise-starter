import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { readRefreshToken, setAuthCookies, clearAuthCookies } from "@/lib/security/cookies";
import { verifyRefreshToken, TokenExpiredAppError, TokenInvalidError } from "@/lib/security/jwt";
import { rotateRefreshToken, revokeSession } from "@/lib/auth/session-service";
import { userRepository } from "@/repositories/user.repository";
import { generateCsrfToken, requireCsrf } from "@/lib/security/csrf";
import { getEnv } from "@/config/env";
import { durationToSeconds } from "@/lib/date/duration-seconds";
import { ok, handleRouteError, fail } from "@/lib/api/response";
import { AuthenticationError, AccountStatusError } from "@/lib/errors/app-error";
import { getRateLimiter, rateLimitKeyFromRequest } from "@/lib/security/rate-limit";

/**
 * Refresh endpoint. The CENTRALIZED FRONTEND API CLIENT is responsible for
 * ensuring only one in-flight refresh request exists at a time
 * (single-flight pattern, requirement #23) - this route itself is stateless
 * per-request and simply performs one rotation per call.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimit = await getRateLimiter("refresh").consume(
      rateLimitKeyFromRequest(request, "refresh", getEnv().TRUSTED_PROXY_HOPS)
    );
    if (!rateLimit.allowed) {
      return fail(429, "RATE_LIMITED", "Too many refresh attempts. Please try again later.");
    }

    await connectToDatabase();
    await requireCsrf(request);

    const refreshToken = await readRefreshToken();
    if (!refreshToken) {
      throw new AuthenticationError("No refresh token provided.", "NO_REFRESH_TOKEN");
    }

    let payload;
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch (err) {
      await clearAuthCookies();
      if (err instanceof TokenExpiredAppError) {
        throw new AuthenticationError("Refresh token expired. Please log in again.", "REFRESH_TOKEN_EXPIRED");
      }
      if (err instanceof TokenInvalidError) {
        throw new AuthenticationError("Invalid refresh token.", "REFRESH_TOKEN_INVALID");
      }
      throw err;
    }

    const user = await userRepository.findById(payload.sub);
    if (!user) {
      await clearAuthCookies();
      throw new AuthenticationError("User not found.", "USER_NOT_FOUND");
    }
    if (user.tokenVersion !== payload.tokenVersion) {
      await clearAuthCookies();
      await revokeSession(payload.sessionId, "TOKEN_VERSION_MISMATCH");
      throw new AuthenticationError("Session no longer valid. Please log in again.", "TOKEN_VERSION_MISMATCH");
    }
    if (user.status === "DISABLED" || user.status === "BLOCKED") {
      await clearAuthCookies();
      await revokeSession(payload.sessionId, `ACCOUNT_${user.status}`);
      throw new AccountStatusError(`This account has been ${user.status.toLowerCase()}.`, `ACCOUNT_${user.status}`);
    }

    let rotated;
    try {
      rotated = await rotateRefreshToken({
        sessionId: payload.sessionId,
        incomingJti: payload.jti,
        userId: String(user._id),
        tokenVersion: user.tokenVersion,
        userAgent: request.headers.get("user-agent") ?? undefined,
        ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      });
    } catch (err) {
      await clearAuthCookies();
      throw err;
    }

    const env = getEnv();
    const csrfToken = generateCsrfToken();
    await setAuthCookies({
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      csrfToken,
      accessMaxAgeSeconds: durationToSeconds(env.ACCESS_TOKEN_EXPIRES_IN),
      refreshMaxAgeSeconds: durationToSeconds(env.REFRESH_TOKEN_EXPIRES_IN),
    });

    return ok({ refreshed: true }, { code: "TOKEN_REFRESHED", message: "Session refreshed." });
  } catch (err) {
    return handleRouteError(err);
  }
}
