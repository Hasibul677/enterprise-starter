import { cookies } from "next/headers";
import { getEnv } from "@/config/env";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const CSRF_COOKIE = "csrf_token";

/**
 * Cookie strategy (see requirement #19):
 * - HttpOnly + Secure (prod) + SameSite=Lax for both auth cookies so neither
 *   is readable by client JS (mitigates XSS token theft).
 * - SameSite=Lax already blocks the token being sent on cross-site *forms*
 *   for state-changing requests in modern browsers; on top of that we issue
 *   a separate, NON-HttpOnly, per-session CSRF token that the centralized
 *   API client must echo back as an `x-csrf-token` header on every mutating
 *   request. Route handlers verify the header matches the cookie
 *   (double-submit cookie pattern) before trusting any mutation.
 */
function isProd() {
  return getEnv().NODE_ENV === "production";
}

export async function setAuthCookies(params: {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  accessMaxAgeSeconds: number;
  refreshMaxAgeSeconds: number;
}) {
  const store = await cookies();
  store.set(ACCESS_TOKEN_COOKIE, params.accessToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: params.accessMaxAgeSeconds,
  });
  store.set(REFRESH_TOKEN_COOKIE, params.refreshToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/api/auth",
    maxAge: params.refreshMaxAgeSeconds,
  });
  store.set(CSRF_COOKIE, params.csrfToken, {
    httpOnly: false,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: params.refreshMaxAgeSeconds,
  });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(ACCESS_TOKEN_COOKIE);
  store.delete(REFRESH_TOKEN_COOKIE);
  store.delete(CSRF_COOKIE);
}

export async function readAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_TOKEN_COOKIE)?.value;
}

export async function readRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_TOKEN_COOKIE)?.value;
}
