import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  TokenExpiredAppError,
  TokenInvalidError,
} from "@/lib/security/jwt";

describe("JWT signing and verification", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("signs and verifies a valid access token with minimal claims", async () => {
    const token = await signAccessToken({ userId: "user-1", sessionId: "session-1", tokenVersion: 0 });
    const payload = await verifyAccessToken(token);

    expect(payload.sub).toBe("user-1");
    expect(payload.sessionId).toBe("session-1");
    expect(payload.tokenVersion).toBe(0);
    expect(payload.tokenType).toBe("access");
    // Requirement #18: no user object / permissions / menus embedded.
    expect(payload).not.toHaveProperty("user");
    expect(payload).not.toHaveProperty("permissions");
    expect(payload).not.toHaveProperty("menus");
  });

  it("signs and verifies a valid refresh token", async () => {
    const token = await signRefreshToken({ userId: "user-1", sessionId: "session-1", tokenVersion: 0, jti: "jti-abc" });
    const payload = await verifyRefreshToken(token);

    expect(payload.tokenType).toBe("refresh");
    expect(payload.jti).toBe("jti-abc");
  });

  it("rejects an access token when verified as a refresh token (type confusion guard)", async () => {
    const token = await signAccessToken({ userId: "user-1", sessionId: "session-1", tokenVersion: 0 });
    await expect(verifyRefreshToken(token)).rejects.toThrow(TokenInvalidError);
  });

  it("rejects a tampered/invalid token", async () => {
    await expect(verifyAccessToken("not-a-real-jwt")).rejects.toThrow(TokenInvalidError);
  });

  it("throws TokenExpiredAppError for an expired access token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
    const token = await signAccessToken({ userId: "user-1", sessionId: "session-1", tokenVersion: 0 });
    vi.setSystemTime(new Date("2020-01-01T01:00:00Z")); // +1h, well past 30m expiry
    await expect(verifyAccessToken(token)).rejects.toThrow(TokenExpiredAppError);
    vi.useRealTimers();
  });
});
