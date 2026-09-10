import { describe, it, expect } from "vitest";
import { verifyCsrf } from "@/lib/security/csrf";

function request(method: string, csrfHeader?: string): Request {
  return new Request("https://example.com/api/roles", {
    method,
    headers: csrfHeader !== undefined ? { "x-csrf-token": csrfHeader } : {},
  });
}

describe("verifyCsrf (P0 fix - CSRF must cover every state-changing route)", () => {
  it("always allows safe methods, regardless of token state", () => {
    expect(verifyCsrf(request("GET"), undefined)).toBe(true);
    expect(verifyCsrf(request("HEAD"), undefined)).toBe(true);
    expect(verifyCsrf(request("OPTIONS"), undefined)).toBe(true);
  });

  it("rejects a mutating request with no CSRF cookie at all", () => {
    expect(verifyCsrf(request("POST", "token-123"), undefined)).toBe(false);
  });

  it("rejects a mutating request with no CSRF header", () => {
    expect(verifyCsrf(request("POST"), "token-123")).toBe(false);
  });

  it("rejects a mutating request where the header doesn't match the cookie", () => {
    expect(verifyCsrf(request("POST", "attacker-guess"), "real-cookie-value")).toBe(false);
  });

  it("accepts a mutating request where the header matches the cookie (double-submit satisfied)", () => {
    expect(verifyCsrf(request("POST", "matching-token"), "matching-token")).toBe(true);
  });

  it("applies the same rule to PUT, PATCH, and DELETE", () => {
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      expect(verifyCsrf(request(method, "t"), "t")).toBe(true);
      expect(verifyCsrf(request(method, "t"), "other")).toBe(false);
    }
  });
});
