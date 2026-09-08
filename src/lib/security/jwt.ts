import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { nanoid } from "nanoid";
import { getEnv } from "@/config/env";

export type TokenType = "access" | "refresh";

/**
 * Deliberately minimal JWT claims - see requirement #18.
 * No user object, no permissions, no menu tree ever goes in the token.
 * Authorization is always re-resolved server-side from the database.
 */
export type AppJwtPayload = JWTPayload & {
  sub: string; // userId
  sessionId: string;
  tokenType: TokenType;
  tokenVersion: number;
  jti: string;
  // Present only for an impersonation session (requirement #21): the
  // SUPER_ADMIN userId that initiated it. `sub` above is always the
  // EFFECTIVE identity (the impersonated target) - every permission/menu/
  // route decision in the app keys off `sub` alone, exactly like a normal
  // login, so an impersonated session can never itself carry Super Admin
  // authority. This claim is metadata only: it drives the "Return to Super
  // Admin" flow and the persistent UI banner, nothing else.
  impersonatedBy?: string;
};

function getAccessSecret() {
  return new TextEncoder().encode(getEnv().ACCESS_TOKEN_SECRET);
}
function getRefreshSecret() {
  return new TextEncoder().encode(getEnv().REFRESH_TOKEN_SECRET);
}

export async function signAccessToken(params: {
  userId: string;
  sessionId: string;
  tokenVersion: number;
  impersonatedBy?: string | null;
}): Promise<string> {
  const env = getEnv();
  return new SignJWT({
    tokenType: "access",
    sessionId: params.sessionId,
    tokenVersion: params.tokenVersion,
    ...(params.impersonatedBy ? { impersonatedBy: params.impersonatedBy } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(params.userId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setJti(nanoid())
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_EXPIRES_IN)
    .sign(getAccessSecret());
}

export async function signRefreshToken(params: {
  userId: string;
  sessionId: string;
  tokenVersion: number;
  jti: string;
  impersonatedBy?: string | null;
}): Promise<string> {
  const env = getEnv();
  return new SignJWT({
    tokenType: "refresh",
    sessionId: params.sessionId,
    tokenVersion: params.tokenVersion,
    ...(params.impersonatedBy ? { impersonatedBy: params.impersonatedBy } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(params.userId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setJti(params.jti)
    .setIssuedAt()
    .setExpirationTime(env.REFRESH_TOKEN_EXPIRES_IN)
    .sign(getRefreshSecret());
}

export class TokenExpiredAppError extends Error {}
export class TokenInvalidError extends Error {}

export async function verifyAccessToken(token: string): Promise<AppJwtPayload> {
  return verifyToken(token, "access");
}

export async function verifyRefreshToken(token: string): Promise<AppJwtPayload> {
  return verifyToken(token, "refresh");
}

async function verifyToken(token: string, expectedType: TokenType): Promise<AppJwtPayload> {
  const env = getEnv();
  const secret = expectedType === "access" ? getAccessSecret() : getRefreshSecret();

  let payload: JWTPayload;
  try {
    const result = await jwtVerify(token, secret, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    payload = result.payload;
  } catch (err) {
    if (err instanceof Error && err.name === "JWTExpired") {
      throw new TokenExpiredAppError("Token expired.");
    }
    throw new TokenInvalidError("Token invalid.");
  }

  if (
    payload.tokenType !== expectedType ||
    typeof payload.sub !== "string" ||
    typeof payload.sessionId !== "string" ||
    typeof payload.tokenVersion !== "number" ||
    typeof payload.jti !== "string"
  ) {
    throw new TokenInvalidError("Malformed token payload.");
  }

  return payload as AppJwtPayload;
}
