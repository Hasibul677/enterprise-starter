import { describe, it, expect } from "vitest";
import { rateLimitKeyFromRequest } from "@/lib/security/rate-limit";

function requestWithXff(value: string | null): Request {
  return new Request("https://example.com/api/auth/login", {
    method: "POST",
    headers: value ? { "x-forwarded-for": value } : {},
  });
}

describe("rateLimitKeyFromRequest (P0 fix - X-Forwarded-For must not be blindly trusted)", () => {
  it("never trusts X-Forwarded-For when trustedProxyHops is 0 (the safe default)", () => {
    const key1 = rateLimitKeyFromRequest(requestWithXff("1.2.3.4"), "login", 0);
    const key2 = rateLimitKeyFromRequest(requestWithXff("9.9.9.9"), "login", 0);
    // Both spoofed values collapse into the same key - no longer possible to
    // mint a fresh bucket per request by spoofing the header.
    expect(key1).toBe(key2);
    expect(key1).toBe("login:unknown");
  });

  it("ignores a missing header regardless of trustedProxyHops", () => {
    expect(rateLimitKeyFromRequest(requestWithXff(null), "login", 0)).toBe("login:unknown");
  });

  it("with trustedProxyHops=1, trusts the last (rightmost) entry - the one the trusted proxy itself appended", () => {
    // Client sent "attacker-spoofed-ip", the one real trusted proxy in front
    // of this app appended the real client IP after it.
    const key = rateLimitKeyFromRequest(requestWithXff("attacker-spoofed-ip, 203.0.113.9"), "login", 1);
    expect(key).toBe("login:203.0.113.9");
  });

  it("with trustedProxyHops=1, a client cannot spoof a different bucket on every request", () => {
    const key1 = rateLimitKeyFromRequest(requestWithXff("1.1.1.1, 203.0.113.9"), "login", 1);
    const key2 = rateLimitKeyFromRequest(requestWithXff("2.2.2.2, 203.0.113.9"), "login", 1);
    // Only the trusted proxy's own appended value matters - the attacker-
    // controlled prefix is ignored, so both requests key to the same bucket.
    expect(key1).toBe(key2);
    expect(key1).toBe("login:203.0.113.9");
  });

  it("with trustedProxyHops=2, trusts the second-from-right entry", () => {
    const key = rateLimitKeyFromRequest(
      requestWithXff("attacker-spoofed-ip, 203.0.113.9, 198.51.100.7"),
      "login",
      2
    );
    expect(key).toBe("login:203.0.113.9");
  });

  it("falls back to unknown when trustedProxyHops exceeds the actual chain length", () => {
    const key = rateLimitKeyFromRequest(requestWithXff("203.0.113.9"), "login", 3);
    expect(key).toBe("login:unknown");
  });

  it("keys are namespaced per action", () => {
    const loginKey = rateLimitKeyFromRequest(requestWithXff(null), "login", 0);
    const registerKey = rateLimitKeyFromRequest(requestWithXff(null), "register", 0);
    expect(loginKey).not.toBe(registerKey);
  });
});
