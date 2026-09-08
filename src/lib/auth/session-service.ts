import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { getEnv } from "@/config/env";
import { addDurationFromNow } from "@/lib/date/dayjs";
import { sessionRepository } from "@/repositories/session.repository";
import { auditLogRepository } from "@/repositories/audit-log.repository";
import { signAccessToken, signRefreshToken } from "@/lib/security/jwt";
import { AuthenticationError } from "@/lib/errors/app-error";

const REFRESH_HASH_ROUNDS = 10;

/**
 * Issues a brand-new session + token pair (used at login, at rotation, and
 * to start an impersonation session - requirement #21). The refresh token's
 * jti is hashed before being persisted - a DB read alone can never be
 * replayed as a valid refresh token.
 *
 * `impersonatedBy` (Super Admin userId), when passed, is stamped onto both
 * the session record and the tokens themselves - this is what makes the
 * resulting session identifiable as an impersonation of `userId`, while
 * every actual authorization decision still keys off `userId` alone.
 */
export async function issueTokenPair(params: {
  userId: string;
  tokenVersion: number;
  userAgent?: string;
  ipAddress?: string;
  impersonatedBy?: string | null;
}) {
  const env = getEnv();
  const sessionId = nanoid();
  const refreshJti = nanoid();
  const refreshTokenHash = await bcrypt.hash(refreshJti, REFRESH_HASH_ROUNDS);

  const accessToken = await signAccessToken({
    userId: params.userId,
    sessionId,
    tokenVersion: params.tokenVersion,
    impersonatedBy: params.impersonatedBy,
  });
  const refreshToken = await signRefreshToken({
    userId: params.userId,
    sessionId,
    tokenVersion: params.tokenVersion,
    jti: refreshJti,
    impersonatedBy: params.impersonatedBy,
  });

  await sessionRepository.create({
    userId: params.userId as unknown as never,
    sessionId,
    refreshTokenHash,
    refreshJti,
    expiresAt: addDurationFromNow(env.REFRESH_TOKEN_EXPIRES_IN),
    userAgent: params.userAgent ?? null,
    ipAddress: params.ipAddress ?? null,
    impersonatedBy: (params.impersonatedBy ?? null) as unknown as never,
  });

  return { accessToken, refreshToken, sessionId };
}

/**
 * Refresh-token rotation with reuse detection (requirement #21).
 *
 * On every refresh:
 *  1. The incoming refresh JWT is verified (signature/expiry/type) by the caller.
 *  2. We load the session by sessionId and compare the *hash* of the jti.
 *  3. If the session is already revoked, this is either a stale/expired
 *     session OR a REPLAYED (already-rotated) refresh token: we treat both
 *     as a security event and revoke the whole session lineage, forcing logout.
 *  4. On success we revoke the old session record and issue a fresh pair
 *     under the SAME sessionId isn't reused; the sessionId itself is stable
 *     for the lifetime of this login, but the refresh token/jti rotates.
 */
export async function rotateRefreshToken(params: {
  sessionId: string;
  incomingJti: string;
  userId: string;
  tokenVersion: number;
  userAgent?: string;
  ipAddress?: string;
}) {
  const existing = await sessionRepository.findBySessionId(params.sessionId);

  if (!existing) {
    throw new AuthenticationError("Session not found.", "SESSION_NOT_FOUND");
  }

  if (existing.revokedAt) {
    // Reuse of an already-rotated (or manually revoked) refresh token.
    // Defensive: revoke again (idempotent) and refuse to issue new tokens.
    await auditLogRepository.record({
      actorUserId: params.userId,
      action: "REFRESH_TOKEN_REUSE_DETECTED",
      entityType: "Session",
      entityId: params.sessionId,
      metadata: { previousRevokeReason: existing.revokeReason },
    });
    throw new AuthenticationError(
      "This session has been revoked. Please log in again.",
      "REFRESH_REUSE_DETECTED"
    );
  }

  const matches = await bcrypt.compare(params.incomingJti, existing.refreshTokenHash);
  if (!matches) {
    // jti doesn't match what we stored for this session - also treat as reuse/tamper.
    await sessionRepository.revoke(params.sessionId, "REFRESH_TOKEN_MISMATCH");
    await auditLogRepository.record({
      actorUserId: params.userId,
      action: "REFRESH_TOKEN_REUSE_DETECTED",
      entityType: "Session",
      entityId: params.sessionId,
      metadata: { reason: "JTI_MISMATCH" },
    });
    throw new AuthenticationError("Invalid refresh token.", "REFRESH_INVALID");
  }

  // Rotate: revoke the old record, issue a new session record + token pair.
  // Carry `impersonatedBy` forward from the record being rotated, so a
  // silent background refresh never "promotes" an impersonation session
  // back into looking like a normal one (requirement #21).
  await sessionRepository.revoke(params.sessionId, "ROTATED");

  const rotated = await issueTokenPair({
    userId: params.userId,
    tokenVersion: params.tokenVersion,
    userAgent: params.userAgent,
    ipAddress: params.ipAddress,
    impersonatedBy: existing.impersonatedBy ? String(existing.impersonatedBy) : null,
  });

  await auditLogRepository.record({
    actorUserId: params.userId,
    action: "TOKEN_REFRESHED",
    entityType: "Session",
    entityId: rotated.sessionId,
  });

  return rotated;
}

export async function revokeSession(sessionId: string, reason = "LOGOUT") {
  return sessionRepository.revoke(sessionId, reason);
}

export async function revokeAllSessionsForUser(userId: string, reason = "LOGOUT_ALL") {
  return sessionRepository.revokeAllForUser(userId, reason);
}
