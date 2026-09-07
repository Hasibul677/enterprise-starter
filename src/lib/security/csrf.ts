import { nanoid } from "nanoid";

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
