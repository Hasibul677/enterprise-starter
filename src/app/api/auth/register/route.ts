import { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { registerSchema } from "@/features/auth/schemas/register.schema";
import { registerUser } from "@/lib/auth/auth-service";
import { created, fail, handleRouteError } from "@/lib/api/response";
import { getRateLimiter, rateLimitKeyFromRequest } from "@/lib/security/rate-limit";
import { getEnv } from "@/config/env";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await getRateLimiter("register").consume(
      rateLimitKeyFromRequest(request, "register", getEnv().TRUSTED_PROXY_HOPS)
    );
    if (!rateLimit.allowed) {
      return fail(429, "RATE_LIMITED", "Too many registration attempts. Please try again later.");
    }

    await connectToDatabase();
    const body = await request.json();
    // Only the 4 allow-listed fields ever leave this schema - any extra
    // fields the client sends (roles, isSuperAdmin, status, ...) are
    // silently dropped by Zod's default parsing (requirement #8).
    const input = registerSchema.parse(body);
    const user = await registerUser(input);
    return created({ user }, "USER_REGISTERED", "Account created successfully.");
  } catch (err) {
    return handleRouteError(err);
  }
}
