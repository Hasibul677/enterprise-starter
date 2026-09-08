import { test, expect } from "@playwright/test";

/**
 * Super Admin "Login as User" impersonation (requirement #21). Requires a
 * running MongoDB seeded via `yarn seed` (see README "Demo credentials")
 * before running `yarn test:e2e` - same constraint as auth.spec.ts /
 * rbac.spec.ts.
 */

const DEMO_PASSWORD = "Passw0rd!123";

async function loginAs(page: import("@playwright/test").Page, email: string, password: string) {
  const response = await page.request.post("/api/auth/login", { data: { email, password } });
  expect(response.ok()).toBeTruthy();
}

test.describe("Impersonation - API-level authorization (requirement #21)", () => {
  test("Admin (non-Super-Admin) cannot call the impersonate endpoint", async ({ page }) => {
    await loginAs(page, "demo-admin@example.com", DEMO_PASSWORD);
    const response = await page.request.post("/api/auth/impersonate", { data: { targetUserId: "000000000000000000000000" } });
    expect(response.status()).toBe(403);
  });

  test("Customer cannot call the impersonate endpoint", async ({ page }) => {
    await loginAs(page, "customer@example.com", DEMO_PASSWORD);
    const response = await page.request.post("/api/auth/impersonate", { data: { targetUserId: "000000000000000000000000" } });
    expect(response.status()).toBe(403);
  });

  test("Super Admin cannot impersonate itself", async ({ page }) => {
    await loginAs(page, process.env.SUPER_ADMIN_EMAIL ?? "", process.env.SUPER_ADMIN_PASSWORD ?? "");
    const me = await (await page.request.get("/api/auth/me")).json();
    const response = await page.request.post("/api/auth/impersonate", { data: { targetUserId: me.data.user._id } });
    expect(response.status()).toBe(403);
    expect((await response.json()).message).toMatch(/own account/);
  });

  test("Return-to-Super-Admin is rejected on a session that was never impersonating", async ({ page }) => {
    await loginAs(page, "customer@example.com", DEMO_PASSWORD);
    const response = await page.request.post("/api/auth/impersonate/end");
    expect(response.status()).toBe(422);
  });
});

test.describe("Impersonation - full session lifecycle (requirement #21)", () => {
  test("Super Admin starts an impersonation session, it behaves exactly like the target's own login, and returning restores the original session", async ({
    page,
  }) => {
    await loginAs(page, process.env.SUPER_ADMIN_EMAIL ?? "", process.env.SUPER_ADMIN_PASSWORD ?? "");

    const usersResponse = await page.request.get("/api/users?limit=50");
    const users = (await usersResponse.json()).data as { _id: string; email: string }[];
    const customer = users.find((u) => u.email === "customer@example.com");
    expect(customer).toBeTruthy();

    // Start impersonation (same request/response cycle a browser click would trigger).
    const startResponse = await page.request.post("/api/auth/impersonate", { data: { targetUserId: customer!._id } });
    expect(startResponse.ok()).toBeTruthy();
    const { redirectTo } = (await startResponse.json()).data;
    expect(redirectTo).toBe("/dashboard");

    // The session (same cookie jar) now IS the target - not a client-side shortcut,
    // a real server-issued session indistinguishable from a normal Customer login.
    const meDuringImpersonation = await (await page.request.get("/api/auth/me")).json();
    expect(meDuringImpersonation.data.user.email).toBe("customer@example.com");
    expect(meDuringImpersonation.data.isSuperAdmin).toBe(false);
    expect(meDuringImpersonation.data.isImpersonating).toBe(true);

    // Enforced exactly like a real Customer session: no admin API access.
    const blockedResponse = await page.request.get("/api/users");
    expect(blockedResponse.status()).toBe(403);

    // The UI banner and "Return to Super Admin" button render on a real page load.
    await page.goto("/dashboard");
    await expect(page.getByText(/You are currently logged in as Demo Customer/)).toBeVisible();
    await page.getByRole("button", { name: "Return to Super Admin" }).click();
    await expect(page).toHaveURL(/\/admin/);

    // No password re-entry - the Super Admin session is fully restored.
    const meAfterReturn = await (await page.request.get("/api/auth/me")).json();
    expect(meAfterReturn.data.isSuperAdmin).toBe(true);
    expect(meAfterReturn.data.isImpersonating).toBe(false);
  });
});
