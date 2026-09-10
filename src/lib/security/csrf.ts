import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { CsrfError } from "@/lib/errors/app-error";
import { CSRF_COOKIE } from "@/lib/security/cookies";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function generateCsrfToken(): string {
  return nanoid(32);
}

/** Double-submit-cookie CSRF check for mutating requests. */
export function verifyCsrf(request: Request, cookieValue: string | undefined): boolean {
  if (SAFE_METHODS.has(request.method)) return true;
  const header = request.headers.get("x-csrf-token");
  return Boolean(header && cookieValue && header === cookieValue);
}

/**
 * Route-handler guard: reads the CSRF cookie itself and throws CsrfError
 * (-> handleRouteError -> 403 CSRF_INVALID, same shape every caller used to
 * hand-roll individually) if the double-submit check fails. Every
 * state-changing route (anything that isn't GET/HEAD/OPTIONS) must call this
 * before performing its mutation - see verifyCsrf() above for the underlying
 * check this wraps.
 */
export async function requireCsrf(request: Request): Promise<void> {
  const store = await cookies();
  if (!verifyCsrf(request, store.get(CSRF_COOKIE)?.value)) {
    throw new CsrfError();
  }
}
