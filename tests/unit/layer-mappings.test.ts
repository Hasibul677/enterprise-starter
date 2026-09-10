import { describe, it, expect } from "vitest";
import { resourceOptionsForLayer } from "@/lib/permissions/layer-mappings";
import { CORE_RESOURCES, USER_LAYERS } from "@/lib/permissions/constants";

const { SUPER_ADMIN, ADMIN, COMPANY_ADMIN, MODERATOR, CUSTOMER } = USER_LAYERS;

function usersEntry(layer: (typeof USER_LAYERS)[keyof typeof USER_LAYERS]) {
  const entry = resourceOptionsForLayer(layer).find((r) => r.key === CORE_RESOURCES.USERS);
  if (!entry) throw new Error(`"users" missing from resourceOptionsForLayer(${layer})`);
  return entry;
}

describe("resourceOptionsForLayer (Users -> 'Login as' capability, not a separate Impersonation resource)", () => {
  it("never returns a standalone 'impersonation' resource for any layer", () => {
    for (const layer of [SUPER_ADMIN, ADMIN, COMPANY_ADMIN, MODERATOR, CUSTOMER]) {
      expect(resourceOptionsForLayer(layer).some((r) => r.key === "impersonation")).toBe(false);
    }
  });

  it("shows the 'login_as' action on the Users resource only for an ADMIN-layer role/user", () => {
    expect(usersEntry(ADMIN).hiddenActions).toBeUndefined();
  });

  it("hides 'login_as' on the Users resource for every other layer - Company Admin/Moderator role management never exposes it", () => {
    for (const layer of [SUPER_ADMIN, COMPANY_ADMIN, MODERATOR, CUSTOMER]) {
      expect(usersEntry(layer).hiddenActions).toEqual(["login_as"]);
    }
  });

  it("Company Admin/Moderator still get the Users resource itself, just without the login_as action", () => {
    for (const layer of [COMPANY_ADMIN, MODERATOR]) {
      expect(resourceOptionsForLayer(layer).map((r) => r.key)).toContain(CORE_RESOURCES.USERS);
    }
  });

  it("never shows 'login_as' on any resource OTHER than Users, even when editing an ADMIN-layer role", () => {
    const nonUsersResources = resourceOptionsForLayer(ADMIN).filter((r) => r.key !== CORE_RESOURCES.USERS);
    expect(nonUsersResources.length).toBeGreaterThan(0);
    for (const resource of nonUsersResources) {
      expect(resource.hiddenActions).toEqual(["login_as"]);
    }
  });

  it("every resource hides 'login_as' for every layer other than ADMIN, so the whole column disappears from the matrix", () => {
    for (const layer of [SUPER_ADMIN, COMPANY_ADMIN, MODERATOR, CUSTOMER]) {
      for (const resource of resourceOptionsForLayer(layer)) {
        expect(resource.hiddenActions).toEqual(["login_as"]);
      }
    }
  });
});
