import { NextRequest, NextResponse } from "next/server";
import { resolveCurrentAccess } from "@/lib/auth/current-user";
import { isAdminAreaLayer, isCompanyAdminAreaLayer, getDefaultLandingRoute } from "@/lib/permissions/role-hierarchy";

/**
 * Centralized route-isolation gate for the three dashboard trees
 * (requirement #4):
 *   /admin/**          - Super Admin or Admin
 *   /company-admin/**  - Super Admin, Company Admin, or Moderator
 *   /dashboard/**      - any authenticated, non-disabled/blocked user
 *
 * Next.js 16 runs proxy.ts on the Node.js runtime by default (unlike the old
 * Edge-only `middleware.ts`), so - unlike a classic Edge middleware - this
 * can safely connect to MongoDB and reuse the exact same DB-backed
 * resolveCurrentAccess() used everywhere else: real signature verification,
 * a fresh tokenVersion/status read, and userLayer computed from the DB,
 * never from anything a client could forge (JWT payloads carry no role/
 * permission/layer data - see src/lib/security/jwt.ts).
 *
 * This is still only the first line of defense. Per Next's own guidance,
 * proxy matchers can be misconfigured or bypassed by a refactor, so every
 * page layout (requireAdminAreaPage()/requireCompanyAdminAreaPage()) and
 * every API route (requireAdminAreaAccess()/requirePermission()/etc.)
 * independently re-checks this - nothing here is ever the sole gate.
 */
const ADMIN_PREFIX = "/admin";
const COMPANY_ADMIN_PREFIX = "/company-admin";
const DASHBOARD_PREFIX = "/dashboard";
const AUTH_PAGES = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith(ADMIN_PREFIX);
  const isCompanyAdminRoute = pathname.startsWith(COMPANY_ADMIN_PREFIX);
  const isDashboardRoute = pathname.startsWith(DASHBOARD_PREFIX);
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (!isAdminRoute && !isCompanyAdminRoute && !isDashboardRoute && !isAuthPage) {
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

  if (isAdminRoute && !access.isSuperAdmin && !isAdminAreaLayer(access.userLayer)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isCompanyAdminRoute && !access.isSuperAdmin && !isCompanyAdminAreaLayer(access.userLayer)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/company-admin/:path*", "/dashboard/:path*", "/login", "/register"],
};
