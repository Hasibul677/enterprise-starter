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
 *
 * This file ALSO now generates the per-request Content-Security-Policy
 * nonce (P0-follow-up fix - see the module doc comment on buildCsp() below
 * for why). That's unrelated to the auth-redirect logic above and would
 * ordinarily run on a much narrower matcher, but a nonce has to be minted
 * for every page response, so the matcher was widened accordingly; the
 * auth-redirect branches are untouched and still only ever evaluate for
 * /admin, /company-admin, /dashboard, /login, /register.
 */
const ADMIN_PREFIX = "/admin";
const COMPANY_ADMIN_PREFIX = "/company-admin";
const DASHBOARD_PREFIX = "/dashboard";
const AUTH_PAGES = ["/login", "/register"];

const isProd = process.env.NODE_ENV === "production";

/**
 * Same directive set next.config.ts used to ship statically, with one
 * change: script-src now carries a fresh per-request nonce + 'strict-dynamic'
 * instead of a bare 'self'. Next.js's own hydration/RSC-flight-data payload
 * ships as an inline <script>self.__next_f.push(...)</script> on every page
 * (see /docs/app/guides/content-security-policy) - a bare `script-src 'self'`
 * has no way to allow that (it's inline, not same-origin-by-URL), so the
 * browser silently refused to execute it, the client never received its
 * hydration data, and every <Suspense> boundary's SSR fallback (e.g.
 * login/page.tsx's "Loading sign-in...") stayed on screen forever. This is
 * the officially documented fix - nonce + 'strict-dynamic', never
 * 'unsafe-inline' (which would remove the actual XSS protection CSP exists
 * for). 'self' is kept alongside the nonce as a fallback for browsers that
 * don't understand 'strict-dynamic'. Every other directive is unchanged from
 * the original P0 fix.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A fresh nonce every request (Next.js requires dynamic rendering to
  // apply it - see the `dynamic = "force-dynamic"` export on
  // src/app/(auth)/layout.tsx for the one route group that needed to opt in;
  // every other page in this app is already dynamically rendered).
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspValue = isProd ? buildCsp(nonce) : null;

  // Forwarded to the app so Next can auto-nonce its own generated script
  // tags during SSR (it parses this same CSP header off the request) and so
  // Server Components can read `headers().get("x-nonce")` if ever needed.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  if (cspValue) requestHeaders.set("Content-Security-Policy", cspValue);

  function next() {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (cspValue) res.headers.set("Content-Security-Policy", cspValue);
    return res;
  }

  function redirectTo(url: URL) {
    const res = NextResponse.redirect(url);
    if (cspValue) res.headers.set("Content-Security-Policy", cspValue);
    return res;
  }

  const isAdminRoute = pathname.startsWith(ADMIN_PREFIX);
  const isCompanyAdminRoute = pathname.startsWith(COMPANY_ADMIN_PREFIX);
  const isDashboardRoute = pathname.startsWith(DASHBOARD_PREFIX);
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (!isAdminRoute && !isCompanyAdminRoute && !isDashboardRoute && !isAuthPage) {
    return next();
  }

  let access;
  try {
    access = await resolveCurrentAccess(request);
  } catch {
    access = null;
  }

  if (isAuthPage) {
    if (access) {
      return redirectTo(new URL(getDefaultLandingRoute(access), request.url));
    }
    return next();
  }

  if (!access) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return redirectTo(loginUrl);
  }

  if (isAdminRoute && !access.isSuperAdmin && !isAdminAreaLayer(access.userLayer)) {
    return redirectTo(new URL("/dashboard", request.url));
  }

  if (isCompanyAdminRoute && !access.isSuperAdmin && !isCompanyAdminAreaLayer(access.userLayer)) {
    return redirectTo(new URL("/dashboard", request.url));
  }

  return next();
}

export const config = {
  // Widened from the original 5-route allow-list (admin/company-admin/
  // dashboard/login/register) to every route except static assets, so a CSP
  // nonce is minted for every page response - the auth-redirect branches
  // above are unaffected and still only ever fire for that original 5-route
  // set. Static assets and prefetch requests are excluded per Next's own
  // recommended proxy matcher for CSP nonces (they don't render inline
  // scripts, so they don't need a nonce).
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
