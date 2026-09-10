import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Baseline security headers (P0 audit fix - "no security headers anywhere").
 * Applied to every response via Next's `headers()` config.
 *
 * Content-Security-Policy deliberately does NOT live here: a nonce-based
 * script-src only exists per-request, and this config-level `headers()`
 * function has no access to a request - it can only emit a static value.
 * CSP (with a fresh nonce every request) is instead generated in
 * src/proxy.ts, which does have per-request context, following Next.js's
 * documented proxy-based nonce pattern. See src/proxy.ts for the CSP
 * directives and why. HSTS has no such requirement (it never varies by
 * request) so it stays here alongside the other static headers.
 *
 * CSP/HSTS are gated to production only: Next's dev server needs an HMR
 * websocket connection and `eval()`-based Fast Refresh, both of which a real
 * CSP would legitimately block - shipping a dev-only-broken CSP would just
 * get disabled by the next developer. The always-safe headers (nosniff,
 * frame-ancestors/X-Frame-Options, Referrer-Policy) apply in every
 * environment since none of them interfere with local development.
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
