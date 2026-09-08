import { test, expect } from "@playwright/test";

/**
 * End-to-end RBAC hierarchy coverage (requirement #15/#18 - direct URL/API
 * privilege-escalation matrix). Requires a running MongoDB seeded via
 * `yarn seed` (see README "Demo credentials") before running `yarn test:e2e` -
 * not runnable inside the original scaffolding sandbox, same as auth.spec.ts.
 */

const DEMO_PASSWORD = "Passw0rd!123";

async function loginAs(page: import("@playwright/test").Page, email: string, password: string) {
  const response = await page.request.post("/api/auth/login", { data: { email, password } });
  expect(response.ok()).toBeTruthy();
}

test.describe("Role hierarchy - direct URL protection", () => {
  test("Customer is redirected away from both admin dashboards", async ({ page }) => {
    await loginAs(page, "customer@example.com", DEMO_PASSWORD);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/normal-admin");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("Moderator can reach /normal-admin but not /admin", async ({ page }) => {
    await loginAs(page, "moderator@example.com", DEMO_PASSWORD);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/normal-admin");
    await expect(page).toHaveURL(/\/normal-admin/);
  });

  test("Normal Admin can reach /normal-admin but not /admin", async ({ page }) => {
    await loginAs(page, "normaladmin@example.com", DEMO_PASSWORD);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/normal-admin");
    await expect(page).toHaveURL(/\/normal-admin/);
  });

  test("Admin can reach /admin but not /normal-admin", async ({ page }) => {
    await loginAs(page, "demo-admin@example.com", DEMO_PASSWORD);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/normal-admin");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("Super Admin can reach both admin dashboards", async ({ page }) => {
    await loginAs(page, process.env.SUPER_ADMIN_EMAIL ?? "", process.env.SUPER_ADMIN_PASSWORD ?? "");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/normal-admin");
    await expect(page).toHaveURL(/\/normal-admin/);
  });
});

test.describe("Role hierarchy - API-level privilege escalation (requirement #15)", () => {
  test("Normal Admin cannot create an Admin user via the API", async ({ page }) => {
    await loginAs(page, "normaladmin@example.com", DEMO_PASSWORD);

    const rolesResponse = await page.request.get("/api/roles");
    const roles = (await rolesResponse.json()).data as { slug: string; _id: string }[];
    const adminRoleId = roles.find((r) => r.slug === "admin")?._id;

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

  test("Moderator cannot access the Users API at all (no users.add permission by default)", async ({ page }) => {
    await loginAs(page, "moderator@example.com", DEMO_PASSWORD);
    const response = await page.request.get("/api/users");
    expect(response.status()).toBe(403);
  });

  test("Customer cannot reach any admin API directly", async ({ page }) => {
    await loginAs(page, "customer@example.com", DEMO_PASSWORD);
    const response = await page.request.get("/api/users");
    expect(response.status()).toBe(403);
  });
});

test.describe("Role deactivation is blocked while assigned to a user", () => {
  test("a role currently held by a user cannot be deactivated or deleted, even after that user is disabled", async ({ page }) => {
    await loginAs(page, process.env.SUPER_ADMIN_EMAIL ?? "", process.env.SUPER_ADMIN_PASSWORD ?? "");

    const roleResponse = await page.request.post("/api/roles", {
      data: { name: "E2E Temp Role", slug: `e2e-temp-role-${Date.now()}`, permissions: {} },
    });
    expect(roleResponse.ok()).toBeTruthy();
    const roleId = (await roleResponse.json()).data.role._id as string;

    const userResponse = await page.request.post("/api/users", {
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
    const userId = (await userResponse.json()).data.user._id as string;

    // Still assigned -> both the DELETE (deactivate) and PATCH isActive:false paths must reject it.
    const deleteAttempt = await page.request.delete(`/api/roles/${roleId}`);
    expect(deleteAttempt.status()).toBe(422);
    const patchAttempt = await page.request.patch(`/api/roles/${roleId}`, { data: { isActive: false } });
    expect(patchAttempt.status()).toBe(422);

    // Disabling the USER (not unassigning the role) must not be enough to unblock it -
    // the role reference itself is what's checked, regardless of the user's status.
    const disableUser = await page.request.delete(`/api/users/${userId}`);
    expect(disableUser.ok()).toBeTruthy();
    const stillBlocked = await page.request.delete(`/api/roles/${roleId}`);
    expect(stillBlocked.status()).toBe(422);

    // Reassigning the user away from the role is what actually unblocks it.
    const rolesResponse = await page.request.get("/api/roles");
    const roles = (await rolesResponse.json()).data as { slug: string; _id: string }[];
    const customerRoleId = roles.find((r) => r.slug === "customer")?._id;
    const reassign = await page.request.patch(`/api/users/${userId}`, { data: { roleIds: [customerRoleId] } });
    expect(reassign.ok()).toBeTruthy();

    const deactivateAfterReassign = await page.request.delete(`/api/roles/${roleId}`);
    expect(deactivateAfterReassign.ok()).toBeTruthy();
  });
});
