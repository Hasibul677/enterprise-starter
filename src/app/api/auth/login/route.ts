import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { loginSchema } from "@/features/auth/schemas/login.schema";
import { loginUser } from "@/lib/auth/auth-service";
import { setAuthCookies } from "@/lib/security/cookies";
import { generateCsrfToken } from "@/lib/security/csrf";
import { getEnv } from "@/config/env";
import { durationToSeconds } from "@/lib/date/duration-seconds";
import { ok, handleRouteError, fail } from "@/lib/api/response";
import { mergeRolePermissions } from "@/lib/permissions/merge";
import { SUPER_ADMIN_ROLE_SLUG } from "@/lib/permissions/constants";
import { getRateLimiter, rateLimitKeyFromRequest } from "@/lib/security/rate-limit";
import type { RoleDocument } from "@/models/role.model";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await getRateLimiter("login").consume(rateLimitKeyFromRequest(request, "login"));
    if (!rateLimit.allowed) {
      return fail(429, "RATE_LIMITED", "Too many login attempts. Please try again later.");
    }

    await connectToDatabase();
    const body = await request.json();
    const input = loginSchema.parse(body);

    const { user, accessToken, refreshToken } = await loginUser({
      email: input.email,
      password: input.password,
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

    const roles = (user.roles as unknown as RoleDocument[]) ?? [];
    const permissions = mergeRolePermissions(
      roles.map((r) => ({ isActive: r.isActive, permissions: Object.fromEntries(r.permissions as unknown as Map<string, never>) }))
    );
    const isSuperAdmin = roles.some((r) => r.isActive && r.slug === SUPER_ADMIN_ROLE_SLUG);

    return ok(
      { user, roles, permissions, isSuperAdmin, warning: user.status === "WARNING" },
      { code: "LOGIN_SUCCESS", message: "Logged in successfully." }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
