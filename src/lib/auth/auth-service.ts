import { userRepository } from "@/repositories/user.repository";
import { roleRepository } from "@/repositories/role.repository";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "@/lib/security/password";
import { issueTokenPair } from "@/lib/auth/session-service";
import { ValidationError, AuthenticationError, AccountStatusError, ConflictError } from "@/lib/errors/app-error";
import { DEFAULT_USER_ROLE_SLUG } from "@/lib/permissions/constants";
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
