import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentAccess } from "@/lib/auth/current-user";

/**
 * Centralized route-isolation gate for the two dashboard trees:
 *   /admin/**      - Super Admin only
 *   /dashboard/**  - any authenticated, non-disabled/blocked user
 *
 * Next.js 16 runs proxy.ts on the Node.js runtime by default (unlike the old
 * Edge-only `middleware.ts`), so - unlike a classic Edge middleware - this
 * can safely connect to MongoDB and reuse the exact same DB-backed
 * resolveCurrentAccess() used everywhere else: real signature verification,
 * a fresh tokenVersion/status read, and a role computed from the DB, never
 * from anything a client could forge (JWT payloads carry no role/permission
 * data - see src/lib/security/jwt.ts).
 *
 * This is still only the first line of defense. Per Next's own guidance,
 * proxy matchers can be misconfigured or bypassed by a refactor, so every
 * admin page layout (requireSuperAdminPage()) and every admin API route
 * (requireSuperAdmin()/requirePermission()) independently re-checks this -
 * nothing here is ever the sole gate.
 */
const ADMIN_PREFIX = "/admin";
const DASHBOARD_PREFIX = "/dashboard";
const AUTH_PAGES = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith(ADMIN_PREFIX);
  const isDashboardRoute = pathname.startsWith(DASHBOARD_PREFIX);
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (!isAdminRoute && !isDashboardRoute && !isAuthPage) {
    return NextResponse.next();
  }

  let access;
  try {
    access = await resolveCurrentAccess(request);
  } catch {
    access = null;
  }

  if (isAuthPage) {
    if (access) {
      return NextResponse.redirect(new URL(access.isSuperAdmin ? "/admin" : "/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!access) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && !access.isSuperAdmin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/login", "/register"],
};
