import { userRepository } from "@/repositories/user.repository";
import { roleRepository } from "@/repositories/role.repository";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "@/lib/security/password";
import { issueTokenPair, revokeSession } from "@/lib/auth/session-service";
import { ValidationError, AuthenticationError, AccountStatusError, ConflictError, AuthorizationError, NotFoundError } from "@/lib/errors/app-error";
import { DEFAULT_USER_ROLE_SLUG, ROLE_SLUGS } from "@/lib/permissions/constants";
import { getRoleSlugs, getDefaultLandingRoute, getImpersonationIneligibleReason } from "@/lib/permissions/role-hierarchy";
import type { ResolvedAccess } from "@/lib/auth/current-user";
import type { UserDocument } from "@/models/user.model";

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

/**
 * Public registration. Mass-assignment safe by construction: the function
 * signature only accepts the 4 allow-listed fields. Any extra client-supplied
 * fields (roles, isSuperAdmin, status, ...) never reach this function because
 * the Zod schema at the route boundary strips them (see register.schema.ts).
 */
export async function registerUser(input: RegisterInput) {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) {
    throw new ConflictError("An account with this email already exists.");
  }

  if (!isPasswordStrongEnough(input.password)) {
    throw new ValidationError("Password does not meet the minimum strength requirements.", [
      { field: "password", code: "WEAK_PASSWORD", message: "Use at least 8 characters with upper, lower, and a digit." },
    ]);
  }

  const defaultRole = await roleRepository.findBySlug(DEFAULT_USER_ROLE_SLUG);
  if (!defaultRole) {
    throw new Error("Default user role is not seeded. Run `yarn seed` first.");
  }

  const passwordHash = await hashPassword(input.password);
  const user = await userRepository.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email.toLowerCase().trim(),
    passwordHash,
    roles: [defaultRole._id] as unknown as UserDocument["roles"],
    status: "ACTIVE",
  });

  await auditLogRepository.record({
    actorUserId: String(user._id),
    action: "USER_REGISTERED",
    entityType: "User",
    entityId: String(user._id),
  });

  return user;
}

export async function loginUser(params: { email: string; password: string; userAgent?: string; ipAddress?: string }) {
  const user = await userRepository.findByEmail(params.email, true);

  // Avoid revealing whether the email exists (requirement #30).
  const genericError = () => new AuthenticationError("Invalid email or password.", "INVALID_CREDENTIALS");

  if (!user) throw genericError();

  const passwordOk = await verifyPassword(params.password, user.passwordHash);
  if (!passwordOk) throw genericError();

  if (user.status === "DISABLED") {
    throw new AccountStatusError("This account has been disabled.", "ACCOUNT_DISABLED");
  }
  if (user.status === "BLOCKED") {
    throw new AccountStatusError("This account has been blocked.", "ACCOUNT_BLOCKED");
  }

  const { accessToken, refreshToken, sessionId } = await issueTokenPair({
    userId: String(user._id),
    tokenVersion: user.tokenVersion,
    userAgent: params.userAgent,
    ipAddress: params.ipAddress,
  });

  user.lastLoginAt = new Date();
  await user.save();

  await auditLogRepository.record({
    actorUserId: String(user._id),
    action: "USER_LOGIN",
    entityType: "User",
    entityId: String(user._id),
    metadata: { sessionId },
  });

  return { user, accessToken, refreshToken, sessionId };
}

/**
 * Starts a Super Admin "Login as User" impersonation session (requirement
 * #21). Issues a REAL, complete session/token pair for the target user via
 * the exact same issueTokenPair() every normal login uses - the resulting
 * session is indistinguishable from a normal login to every other part of
 * the app (permissions, menus, route guards) except that it carries an
 * `impersonatedBy` claim, which exists purely for the UI banner and the
 * "Return to Super Admin" flow. Authorization for the impersonated session
 * is always re-derived fresh from the target's OWN roles/status - there is
 * no code path by which it could inherit Super Admin authority.
 */
export async function impersonateUser(params: {
  targetUserId: string;
  access: ResolvedAccess;
  userAgent?: string;
  ipAddress?: string;
}) {
  const { targetUserId, access } = params;
  const actorId = String(access.user._id);

  // Defense in depth: requireSuperAdmin() at the route boundary already
  // guarantees the actor is a real Super Admin - this additionally blocks
  // chaining a second impersonation from inside an already-impersonated
  // session (which requireSuperAdmin would already reject anyway, since an
  // impersonated session's isSuperAdmin is derived from the TARGET's real
  // roles, never the original admin's - see current-user.ts).
  if (access.impersonatedBy) {
    throw new AuthorizationError("You are already impersonating a user. Return to Super Admin first.");
  }

  const target = await userRepository.findById(targetUserId);
  if (!target) throw new NotFoundError("User not found.");

  const targetSlugs = getRoleSlugs((target.roles ?? []) as unknown as { slug: string; isActive: boolean }[]);

  const ineligibleReason = getImpersonationIneligibleReason({
    actorUserId: actorId,
    targetUserId,
    targetSlugs,
    targetStatus: target.status,
  });
  if (ineligibleReason) {
    throw new AuthorizationError(ineligibleReason);
  }

  const { accessToken, refreshToken, sessionId } = await issueTokenPair({
    userId: targetUserId,
    tokenVersion: target.tokenVersion,
    userAgent: params.userAgent,
    ipAddress: params.ipAddress,
    impersonatedBy: actorId,
  });

  await auditLogRepository.record({
    actorUserId: actorId,
    targetUserId,
    action: "IMPERSONATION_STARTED",
    entityType: "User",
    entityId: targetUserId,
    metadata: { targetEmail: target.email, targetRoles: targetSlugs, sessionId },
  });

  const redirectTo = getDefaultLandingRoute({ isSuperAdmin: false, roleSlugs: targetSlugs });

  return { accessToken, refreshToken, redirectTo, target };
}

/**
 * Ends an impersonation session and restores the original Super Admin's
 * session (requirement #21 "Return to Super Admin") - no password
 * re-entry: the Super Admin's identity comes from the impersonation
 * token's own signed `impersonatedBy` claim, not from anything client-
 * supplied, and is re-verified fresh against the DB before being trusted.
 */
export async function endImpersonation(params: { access: ResolvedAccess }) {
  const { access } = params;

  if (!access.impersonatedBy) {
    throw new ValidationError("This session is not an impersonation session.");
  }

  const superAdmin = await userRepository.findById(access.impersonatedBy);
  const superAdminSlugs = superAdmin ? getRoleSlugs((superAdmin.roles ?? []) as unknown as { slug: string; isActive: boolean }[]) : [];
  if (!superAdmin || !superAdminSlugs.includes(ROLE_SLUGS.SUPER_ADMIN) || superAdmin.status !== "ACTIVE") {
    throw new AuthenticationError(
      "The original Super Admin account is no longer valid. Please log in again.",
      "SUPER_ADMIN_SESSION_INVALID"
    );
  }

  await revokeSession(access.sessionId, "IMPERSONATION_ENDED");

  const { accessToken, refreshToken } = await issueTokenPair({
    userId: String(superAdmin._id),
    tokenVersion: superAdmin.tokenVersion,
  });

  await auditLogRepository.record({
    actorUserId: String(superAdmin._id),
    targetUserId: String(access.user._id),
    action: "IMPERSONATION_ENDED",
    entityType: "User",
    entityId: String(access.user._id),
  });

  return { accessToken, refreshToken };
}
