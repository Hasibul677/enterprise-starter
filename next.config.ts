import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Baseline security headers (P0 audit fix - "no security headers anywhere").
 * Applied to every response via Next's `headers()` config rather than
 * proxy.ts, since proxy.ts's matcher deliberately only covers the
 * page-navigation routes (see src/proxy.ts) and never touches /api/**.
 *
 * CSP/HSTS are gated to production only: Next's dev server needs an HMR
 * websocket connection and `eval()`-based Fast Refresh, both of which a real
 * CSP would legitimately block - shipping a dev-only-broken CSP would just
 * get disabled by the next developer. The always-safe headers (nosniff,
 * frame-ancestors/X-Frame-Options, Referrer-Policy) apply in every
 * environment since none of them interfere with local development.
 *
 * The one external resource this app actually loads is the Google Fonts
 * stylesheet (`@import` in src/app/globals.css) and the font files it
 * pulls from fonts.gstatic.com - both are explicitly allow-listed below so
 * CSP doesn't break the app's own fonts. `style-src 'unsafe-inline'` is
 * required because the `motion` package and a handful of components set
 * inline `style` attributes at runtime; `script-src 'self'` (no
 * 'unsafe-inline'/'unsafe-eval') is safe because this codebase has no
 * inline <script> tags and no eval()/new Function() usage.
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
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
            ? [
                { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
                { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
