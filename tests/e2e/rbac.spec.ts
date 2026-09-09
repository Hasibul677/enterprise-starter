import { test, expect, request, type APIRequestContext } from "@playwright/test";

/**
 * End-to-end RBAC hierarchy coverage (requirement #15/#18 - direct URL/API
 * privilege-escalation matrix). Requires a running MongoDB seeded via
 * `yarn seed` (see README "Demo credentials") before running `yarn test:e2e` -
 * not runnable inside the original scaffolding sandbox, same as auth.spec.ts.
 *
 * Every test in this file shares one login rate-limit bucket (10/min/IP -
 * see rate-limit.ts), since they all originate from the same test-runner
 * IP. Tests are deliberately consolidated ONE authenticated session per
 * account (multiple assertions via `test.step`) instead of one login per
 * assertion, and Super-Admin-only API checks share a single module-level
 * session (`superAdminApi`) - keeping total login volume well under the
 * limit regardless of how many scenarios this file grows to cover.
 */

const DEMO_PASSWORD = "Passw0rd!123";

async function loginAs(context: APIRequestContext, email: string, password: string) {
  const response = await context.post("/api/auth/login", { data: { email, password } });
  expect(response.ok()).toBeTruthy();
}

let superAdminApi: APIRequestContext;

test.beforeAll(async () => {
  superAdminApi = await request.newContext({ baseURL: "http://localhost:3000" });
  await loginAs(superAdminApi, process.env.SUPER_ADMIN_EMAIL ?? "", process.env.SUPER_ADMIN_PASSWORD ?? "");
});

test.afterAll(async () => {
  await superAdminApi.dispose();
});

test.describe("Customer (CUSTOMER layer)", () => {
  test("is redirected from both admin dashboards and blocked from admin APIs", async ({ page }) => {
    await loginAs(page.request, "customer@example.com", DEMO_PASSWORD);

    await test.step("blocked from /admin", async () => {
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/dashboard/);
    });
    await test.step("blocked from /company-admin", async () => {
      await page.goto("/company-admin");
      await expect(page).toHaveURL(/\/dashboard/);
    });
    await test.step("blocked from the Users API", async () => {
      const response = await page.request.get("/api/users");
      expect(response.status()).toBe(403);
    });
  });
});

test.describe("Moderator (MODERATOR layer)", () => {
  test("can reach /company-admin but not /admin, and cannot access the Users API", async ({ page }) => {
    await loginAs(page.request, "moderator@example.com", DEMO_PASSWORD);

    await test.step("blocked from /admin", async () => {
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/dashboard/);
    });
    await test.step("allowed into /company-admin", async () => {
      await page.goto("/company-admin");
      await expect(page).toHaveURL(/\/company-admin/);
    });
    await test.step("no users.add permission by default", async () => {
      const response = await page.request.get("/api/users");
      expect(response.status()).toBe(403);
    });
  });
});

test.describe("Company Admin (COMPANY_ADMIN layer)", () => {
  test("reaches its own scope, manages its own roles, and cannot escalate to Admin", async ({ page }) => {
    await loginAs(page.request, "companyadmin@example.com", DEMO_PASSWORD);

    await test.step("blocked from /admin", async () => {
      await page.goto("/admin");
      await expect(page).toHaveURL(/\/dashboard/);
    });
    await test.step("allowed into /company-admin", async () => {
      await page.goto("/company-admin");
      await expect(page).toHaveURL(/\/company-admin/);
    });

    await test.step("can create and manage its own MODERATOR-layer role (requirement #4/#6)", async () => {
      const roleResponse = await page.request.post("/api/roles", {
        data: { name: "E2E Recruiter", slug: `e2e-recruiter-${Date.now()}`, userLayer: "MODERATOR", permissions: {} },
      });
      expect(roleResponse.ok()).toBeTruthy();
      const roleId = (await roleResponse.json()).data.role._id as string;
      const ownEdit = await page.request.patch(`/api/roles/${roleId}`, { data: { description: "Updated" } });
      expect(ownEdit.ok()).toBeTruthy();
    });

    await test.step("cannot create an Admin user via the API (requirement #15)", async () => {
      // GET /api/roles is scoped per-actor (requirement #6) - a Company
      // Admin can't even discover the Admin role's id, so it's looked up
      // via the shared Super Admin API session instead.
      const rolesResponse = await superAdminApi.get("/api/roles");
      const roles = (await rolesResponse.json()).data as { slug: string; _id: string }[];
      const adminRoleId = roles.find((r) => r.slug === "admin")?._id;
      expect(adminRoleId).toBeTruthy();

      const response = await page.request.post("/api/users", {
        data: {
          firstName: "Escalation",
          lastName: "Attempt",
          email: `e2e-escalation-${Date.now()}@example.com`,
          password: "GoodPass1",
          roleIds: [adminRoleId],
          status: "ACTIVE",
        },
      });
      expect(response.status()).toBe(403);
    });
  });
});

test.describe("Admin (ADMIN layer)", () => {
  test("can reach /admin but not /company-admin", async ({ page }) => {
    await loginAs(page.request, "demo-admin@example.com", DEMO_PASSWORD);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/company-admin");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("Super Admin (SUPER_ADMIN layer)", () => {
  test("can reach both admin dashboards", async ({ page }) => {
    await loginAs(page.request, process.env.SUPER_ADMIN_EMAIL ?? "", process.env.SUPER_ADMIN_PASSWORD ?? "");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/company-admin");
    await expect(page).toHaveURL(/\/company-admin/);
  });
});

test.describe("Dynamic role deactivation (requirement #16/#17)", () => {
  test("a custom role can be deactivated even while assigned, but a SYSTEM role never can", async () => {
    await test.step("custom role: deactivation succeeds even while a user holds it", async () => {
      const roleResponse = await superAdminApi.post("/api/roles", {
        data: { name: "E2E Temp Role", slug: `e2e-temp-role-${Date.now()}`, userLayer: "CUSTOMER", permissions: {} },
      });
      expect(roleResponse.ok()).toBeTruthy();
      const roleId = (await roleResponse.json()).data.role._id as string;

      const userResponse = await superAdminApi.post("/api/users", {
        data: {
          firstName: "E2E",
          lastName: "RoleHolder",
          email: `e2e-role-holder-${Date.now()}@example.com`,
          password: "GoodPass1",
          roleIds: [roleId],
          status: "ACTIVE",
        },
      });
      expect(userResponse.ok()).toBeTruthy();

      // Still assigned - deactivation succeeds anyway (relies on the live
      // permission-sync feature to gracefully degrade the holder, not a
      // reassign-first workflow).
      const deactivate = await superAdminApi.delete(`/api/roles/${roleId}`);
      expect(deactivate.ok()).toBeTruthy();
    });

    await test.step("a SYSTEM role can never be deactivated, regardless of assignment", async () => {
      const rolesResponse = await superAdminApi.get("/api/roles");
      const roles = (await rolesResponse.json()).data as { slug: string; _id: string }[];
      const customerRoleId = roles.find((r) => r.slug === "customer")?._id;

      const attempt = await superAdminApi.delete(`/api/roles/${customerRoleId}`);
      expect(attempt.status()).toBe(422);
    });
  });
});
