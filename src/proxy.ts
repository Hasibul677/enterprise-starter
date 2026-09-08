import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { isAdminAreaRole, isNormalAdminAreaRole, getDefaultLandingRoute } from "@/lib/permissions/role-hierarchy";

/**
 * Centralized route-isolation gate for the three dashboard trees
 * (requirement #4):
 *   /admin/**         - Super Admin or Admin
 *   /normal-admin/**  - Super Admin, Normal Admin, or Moderator
 *   /dashboard/**     - any authenticated, non-disabled/blocked user
 *
 * Next.js 16 runs proxy.ts on the Node.js runtime by default (unlike the old
 * Edge-only `middleware.ts`), so - unlike a classic Edge middleware - this
 * can safely connect to MongoDB and reuse the exact same DB-backed
 * resolveCurrentAccess() used everywhere else: real signature verification,
 * a fresh tokenVersion/status read, and roles computed from the DB, never
 * from anything a client could forge (JWT payloads carry no role/permission
 * data - see src/lib/security/jwt.ts).
 *
 * This is still only the first line of defense. Per Next's own guidance,
 * proxy matchers can be misconfigured or bypassed by a refactor, so every
 * page layout (requireAdminAreaPage()/requireNormalAdminAreaPage()) and
 * every API route (requireAdminAreaAccess()/requirePermission()/etc.)
 * independently re-checks this - nothing here is ever the sole gate.
 */
const ADMIN_PREFIX = "/admin";
const NORMAL_ADMIN_PREFIX = "/normal-admin";
const DASHBOARD_PREFIX = "/dashboard";
const AUTH_PAGES = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith(ADMIN_PREFIX);
  const isNormalAdminRoute = pathname.startsWith(NORMAL_ADMIN_PREFIX);
  const isDashboardRoute = pathname.startsWith(DASHBOARD_PREFIX);
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (!isAdminRoute && !isNormalAdminRoute && !isDashboardRoute && !isAuthPage) {
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
      return NextResponse.redirect(new URL(getDefaultLandingRoute(access), request.url));
    }
    return NextResponse.next();
  }

  if (!access) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && !access.isSuperAdmin && !isAdminAreaRole(access.roleSlugs)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isNormalAdminRoute && !access.isSuperAdmin && !isNormalAdminAreaRole(access.roleSlugs)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/normal-admin/:path*", "/dashboard/:path*", "/login", "/register"],
};
