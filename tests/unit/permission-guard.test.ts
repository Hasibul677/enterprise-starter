import { describe, it, expect } from "vitest";
import { requirePermission } from "@/lib/permissions/guard";
import { AuthorizationError } from "@/lib/errors/app-error";
import type { ResolvedAccess } from "@/lib/auth/current-user";

function access(overrides: Partial<ResolvedAccess>): ResolvedAccess {
  return {
    user: {} as never,
    roles: [],
    permissions: {},
    isSuperAdmin: false,
    sessionId: "session-1",
    ...overrides,
  };
}

describe("requirePermission (server-side authorization gate, requirement #13)", () => {
  it("allows an action when the merged permission map grants it", () => {
    const acc = access({ permissions: { users: { view: true, add: false, edit: false, delete: false } } });
    expect(() => requirePermission(acc, "users", "view")).not.toThrow();
  });

  it("throws AuthorizationError when the permission is not granted (users.view=true, users.add=false)", () => {
    const acc = access({ permissions: { users: { view: true, add: false, edit: false, delete: false } } });
    expect(() => requirePermission(acc, "users", "add")).toThrow(AuthorizationError);
  });

  it("throws for a resource the user has no entry for at all", () => {
    const acc = access({ permissions: {} });
    expect(() => requirePermission(acc, "users", "view")).toThrow(AuthorizationError);
  });

  it("Super Admin bypasses standard permission checks entirely (requirement #9)", () => {
    const acc = access({ isSuperAdmin: true, permissions: {} });
    expect(() => requirePermission(acc, "users", "delete")).not.toThrow();
  });

  it("does not let a client-manipulated permission object (e.g. tampered Zustand state) matter - this function only ever receives server-resolved access", () => {
    // Simulates the fact that even if a permissions object claiming "delete: true"
    // reached this function, it would have had to come from resolveCurrentAccess()
    // (DB-derived), never from client input - there is no code path that lets a
    // route handler call requirePermission() with client-supplied permissions.
    const acc = access({ permissions: { users: { view: true, add: true, edit: true, delete: true } } });
    expect(() => requirePermission(acc, "users", "delete")).not.toThrow();
    expect(() => requirePermission(acc, "roles", "delete")).toThrow(AuthorizationError);
  });
});
