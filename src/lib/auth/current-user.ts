import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { ACCESS_TOKEN_COOKIE, readAccessToken } from "@/lib/security/cookies";
import { verifyAccessToken, TokenExpiredAppError, TokenInvalidError } from "@/lib/security/jwt";
import { userRepository } from "@/repositories/user.repository";
import { AuthenticationError, AccountStatusError } from "@/lib/errors/app-error";
import { mergeRolePermissions } from "@/lib/permissions/merge";
import { SUPER_ADMIN_ROLE_SLUG } from "@/lib/permissions/constants";
import type { PermissionMap } from "@/lib/permissions/constants";
import type { RoleDocument } from "@/models/role.model";
import type { UserDocument } from "@/models/user.model";

export type ResolvedAccess = {
  user: UserDocument;
  roles: RoleDocument[];
  permissions: PermissionMap;
  isSuperAdmin: boolean;
  sessionId: string;
};

/**
 * The single entry point every protected route handler / server component
 * calls to resolve "who is this and what can they do right now".
 *
 * Deliberately re-reads status + tokenVersion + roles from the DB on every
 * call (cheap indexed lookups) rather than trusting anything cached in the
 * JWT, so that:
 *  - an admin blocking/disabling a user takes effect immediately
 *  - a role/permission change takes effect immediately
 *  - a forced logout (tokenVersion bump) invalidates all outstanding access
 *    tokens immediately, without waiting for their 30-minute expiry
 *
 * Pass a `request` when calling this from `proxy.ts` (which has no access to
 * `next/headers`'s `cookies()`) - route handlers and Server Components can
 * omit it and the cookie is read the normal way. Same DB-backed logic either
 * way; nothing about the authorization decision is duplicated.
 */
export async function resolveCurrentAccess(request?: NextRequest): Promise<ResolvedAccess> {
  const token = request ? request.cookies.get(ACCESS_TOKEN_COOKIE)?.value : await readAccessToken();
  if (!token) {
    throw new AuthenticationError("Authentication required.", "NO_ACCESS_TOKEN");
  }

  // Idempotent/cached - safe even though most callers (route handlers) also
  // call this themselves before other DB work. Centralized here so no new
  // caller (proxy.ts, a page, a layout) can forget it and hang on an
  // unconnected Mongoose query.
  await connectToDatabase();

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch (err) {
    if (err instanceof TokenExpiredAppError) {
      throw new AuthenticationError("Access token expired.", "ACCESS_TOKEN_EXPIRED");
    }
    if (err instanceof TokenInvalidError) {
      throw new AuthenticationError("Invalid access token.", "ACCESS_TOKEN_INVALID");
    }
    throw err;
  }

  const user = await userRepository.findById(payload.sub);
  if (!user) {
    throw new AuthenticationError("User not found.", "USER_NOT_FOUND");
  }

  if (user.tokenVersion !== payload.tokenVersion) {
    // Token was issued before a forced-logout / password-change / security event.
    throw new AuthenticationError("Session no longer valid. Please log in again.", "TOKEN_VERSION_MISMATCH");
  }

  if (user.status === "DISABLED") {
    throw new AccountStatusError("This account has been disabled.", "ACCOUNT_DISABLED");
  }
  if (user.status === "BLOCKED") {
    throw new AccountStatusError("This account has been blocked.", "ACCOUNT_BLOCKED");
  }

  const roles = (user.roles ?? []) as unknown as RoleDocument[];
  const isSuperAdmin = roles.some((r) => r.isActive && r.slug === SUPER_ADMIN_ROLE_SLUG);
  const permissions = mergeRolePermissions(
    roles.map((r) => ({ isActive: r.isActive, permissions: Object.fromEntries(r.permissions as unknown as Map<string, never>) }))
  );

  return { user, roles, permissions, isSuperAdmin, sessionId: payload.sessionId };
}
