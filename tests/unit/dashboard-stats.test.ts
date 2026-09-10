import { describe, it, expect } from "vitest";
import {
  buildMonthlySeries,
  visibleStatsLayers,
  classifyAlertSeverity,
  isAuditLogVisibleToActor,
} from "@/services/dashboard.service";
import { USER_LAYERS } from "@/lib/permissions/constants";

const { SUPER_ADMIN, ADMIN, COMPANY_ADMIN, MODERATOR, CUSTOMER } = USER_LAYERS;

function userRef(
  id: string,
  userLayer: (typeof USER_LAYERS)[keyof typeof USER_LAYERS],
  managedBy?: string | null
) {
  return { _id: id, firstName: "First", lastName: "Last", email: `${id}@example.com`, userLayer, managedBy };
}

describe("buildMonthlySeries (zero-fills gaps for the monthly registrations chart)", () => {
  const now = new Date(2026, 5, 15); // June 15, 2026

  it("returns exactly `monthsBack` entries, oldest to newest, ending at the current month", () => {
    const series = buildMonthlySeries([], 6, now);
    expect(series).toHaveLength(6);
    expect(series[0].month).toBe("2026-01");
    expect(series[5].month).toBe("2026-06");
  });

  it("zero-fills every month with no data", () => {
    const series = buildMonthlySeries([], 3, now);
    expect(series.every((s) => s.count === 0)).toBe(true);
  });

  it("places raw counts in the correct month and leaves the rest zero-filled", () => {
    const series = buildMonthlySeries(
      [
        { _id: "2026-04", count: 5 },
        { _id: "2026-06", count: 12 },
      ],
      3,
      now
    );
    expect(series).toEqual([
      { month: "2026-04", count: 5 },
      { month: "2026-05", count: 0 },
      { month: "2026-06", count: 12 },
    ]);
  });

  it("ignores raw buckets outside the requested window", () => {
    const series = buildMonthlySeries([{ _id: "2025-01", count: 99 }], 3, now);
    expect(series.reduce((sum, s) => sum + s.count, 0)).toBe(0);
  });

  it("defaults to 12 months when monthsBack is omitted", () => {
    expect(buildMonthlySeries([], undefined, now)).toHaveLength(12);
  });
});

describe("visibleStatsLayers (dashboard byLayer breakdown can never include an unauthorized layer)", () => {
  it("Super Admin sees all 5 layers", () => {
    expect(visibleStatsLayers({ isSuperAdmin: true, userLayer: SUPER_ADMIN })).toEqual([
      SUPER_ADMIN,
      ADMIN,
      COMPANY_ADMIN,
      MODERATOR,
      CUSTOMER,
    ]);
  });

  it("Admin sees exactly Company Admin, Moderator, Customer - never Super Admin or its own Admin layer", () => {
    const layers = visibleStatsLayers({ isSuperAdmin: false, userLayer: ADMIN });
    expect(layers).toEqual([COMPANY_ADMIN, MODERATOR, CUSTOMER]);
    expect(layers).not.toContain(SUPER_ADMIN);
    expect(layers).not.toContain(ADMIN);
  });

  it("matches the same fixed hierarchy VIEWABLE_TARGET_LAYERS_BY already enforces for /api/users, so the dashboard can never show a layer the Users list itself would deny", () => {
    for (const [isSuperAdmin, userLayer] of [
      [false, ADMIN],
      [false, COMPANY_ADMIN],
      [false, MODERATOR],
    ] as const) {
      const layers = visibleStatsLayers({ isSuperAdmin, userLayer });
      expect(layers).not.toContain(SUPER_ADMIN);
    }
  });
});

describe("classifyAlertSeverity (System Alerts are derived ONLY from real, already-recorded audit actions)", () => {
  it("classifies the real security-relevant actions at their fixed severity", () => {
    expect(classifyAlertSeverity("REFRESH_TOKEN_REUSE_DETECTED")).toBe("critical");
    expect(classifyAlertSeverity("USER_STATUS_CHANGED_BLOCKED")).toBe("warning");
    expect(classifyAlertSeverity("USER_STATUS_CHANGED_DISABLED")).toBe("warning");
    expect(classifyAlertSeverity("IMPERSONATION_STARTED")).toBe("info");
  });

  it("returns null for every other real action - routine actions never become an alert", () => {
    for (const action of [
      "USER_LOGIN",
      "USER_LOGOUT",
      "TOKEN_REFRESHED",
      "ROLE_UPDATED",
      "MENU_CREATED",
      "USER_CREATED",
    ]) {
      expect(classifyAlertSeverity(action)).toBeNull();
    }
  });
});

describe("isAuditLogVisibleToActor (Recent Activity/Alerts can never expose an unauthorized user's entry)", () => {
  const superAdminAccess = { isSuperAdmin: true, userLayer: SUPER_ADMIN, userId: "super-1" };
  const adminAccess = { isSuperAdmin: false, userLayer: ADMIN, userId: "admin-1" };

  it("Super Admin sees every entry, regardless of actor/target layer", () => {
    expect(
      isAuditLogVisibleToActor({ actorUserId: userRef("x", SUPER_ADMIN), targetUserId: null }, superAdminAccess)
    ).toBe(true);
  });

  it("an Admin always sees its OWN actions, even outside its normal viewable layers", () => {
    expect(isAuditLogVisibleToActor({ actorUserId: userRef("admin-1", ADMIN), targetUserId: null }, adminAccess)).toBe(
      true
    );
  });

  it("an Admin sees an entry whose actor is within its viewable layers", () => {
    expect(
      isAuditLogVisibleToActor({ actorUserId: userRef("ca-1", COMPANY_ADMIN), targetUserId: null }, adminAccess)
    ).toBe(true);
  });

  it("an Admin sees an entry whose target (not actor) is within its viewable layers", () => {
    expect(
      isAuditLogVisibleToActor(
        { actorUserId: userRef("super-1", SUPER_ADMIN), targetUserId: userRef("cust-1", CUSTOMER) },
        adminAccess
      )
    ).toBe(true);
  });

  it("an Admin never sees an entry about a Super Admin or another Admin (not itself), with no in-scope target", () => {
    expect(
      isAuditLogVisibleToActor({ actorUserId: userRef("super-1", SUPER_ADMIN), targetUserId: null }, adminAccess)
    ).toBe(false);
    expect(isAuditLogVisibleToActor({ actorUserId: userRef("admin-2", ADMIN), targetUserId: null }, adminAccess)).toBe(
      false
    );
  });

  it("an Admin never sees a system-actor entry (no actor/target at all) - safe default, not guessed at", () => {
    expect(isAuditLogVisibleToActor({ actorUserId: null, targetUserId: null }, adminAccess)).toBe(false);
  });
});

describe("isAuditLogVisibleToActor - Company Admin ownership scoping (cross-company audit-log hardening)", () => {
  const companyAAccess = { isSuperAdmin: false, userLayer: COMPANY_ADMIN, userId: "ca-A" };

  it("Company Admin sees an entry about its OWN moderator (actor or target)", () => {
    expect(
      isAuditLogVisibleToActor(
        { actorUserId: userRef("mod-of-A", MODERATOR, "ca-A"), targetUserId: null },
        companyAAccess
      )
    ).toBe(true);
    expect(
      isAuditLogVisibleToActor(
        { actorUserId: userRef("ca-A", COMPANY_ADMIN), targetUserId: userRef("mod-of-A", MODERATOR, "ca-A") },
        companyAAccess
      )
    ).toBe(true);
  });

  it("Company Admin never sees an entry about ANOTHER company's moderator, even though the layer matches (the cross-company leak this hardens)", () => {
    expect(
      isAuditLogVisibleToActor(
        { actorUserId: userRef("mod-of-B", MODERATOR, "ca-B"), targetUserId: null },
        companyAAccess
      )
    ).toBe(false);
    expect(
      isAuditLogVisibleToActor(
        { actorUserId: userRef("ca-B", COMPANY_ADMIN), targetUserId: userRef("mod-of-B", MODERATOR, "ca-B") },
        companyAAccess
      )
    ).toBe(false);
  });

  it("Company Admin still sees Customer-layer entries with no ownership restriction (global visibility, requirement #5)", () => {
    expect(
      isAuditLogVisibleToActor({ actorUserId: userRef("cust-1", CUSTOMER), targetUserId: null }, companyAAccess)
    ).toBe(true);
  });

  it("Company Admin never sees an entry about a peer Company Admin or anything above it", () => {
    expect(
      isAuditLogVisibleToActor({ actorUserId: userRef("ca-B", COMPANY_ADMIN), targetUserId: null }, companyAAccess)
    ).toBe(false);
    expect(
      isAuditLogVisibleToActor({ actorUserId: userRef("admin-1", ADMIN), targetUserId: null }, companyAAccess)
    ).toBe(false);
  });
});
